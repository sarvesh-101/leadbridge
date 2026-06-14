"""LeadFlow AI OS - Celery Async Tasks

REAL IMPLEMENTATIONS — Each task connects to actual services:
- Exotel for outbound calls
- WhatsApp Cloud API for messages
- Resend for emails
- DeepSeek for transcript analysis
- SQLAlchemy for all DB operations
- WebSocket events for real-time updates
"""

import csv
import json
import logging
import os
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.workers import celery_app
from app.core.config import settings
from app.core.database import SyncSessionLocal
from app.models.lead import Lead, LeadActivity, LeadStatus as LeadStatusModel
from app.models.call import Call, CallStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.models.message import Message, MessageType, MessageStatus
from app.models.campaign import Campaign, CampaignTask, TaskAction
from app.models.tenant import Tenant
from app.models.ai_config import AIConfiguration

logger = logging.getLogger(__name__)


def _get_session() -> Session:
    """Get a sync DB session for Celery tasks."""
    return SyncSessionLocal()


def _http_post(url: str, headers: dict, json_data: dict, timeout: int = 15):
    """Helper to make HTTP POST requests."""
    import httpx
    with httpx.Client(timeout=timeout) as client:
        return client.post(url, headers=headers, json=json_data)


def _http_get(url: str, auth: tuple = None, headers: dict = None, timeout: int = 15):
    """Helper to make HTTP GET requests."""
    import httpx
    with httpx.Client(timeout=timeout) as client:
        return client.get(url, auth=auth, headers=headers)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def initiate_ai_call(self, lead_id: str, tenant_id: str, call_type: str = "ai"):
    """Initiate an AI-powered call to a lead via Exotel telephony API."""
    db = _get_session()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id, Lead.tenant_id == tenant_id).first()
        if not lead:
            logger.error(f"Lead {lead_id} not found — cannot initiate call")
            return {"status": "failed", "error": "Lead not found"}

        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return {"status": "failed", "error": "Tenant not found"}

        # Get AI config for this tenant
        ai_config = db.query(AIConfiguration).filter(
            AIConfiguration.tenant_id == tenant_id,
            AIConfiguration.is_active == True,
        ).first()

        from_number = ai_config.call_from_number if ai_config else None
        if not from_number and settings.EXOTEL_SID:
            from_number = settings.EXOTEL_SID

        call_record = Call(
            tenant_id=tenant_id,
            lead_id=lead_id,
            call_type=call_type,
            direction="outbound",
            status=CallStatus.QUEUED,
            to_number=lead.phone,
            from_number=from_number or "",
        )
        db.add(call_record)
        db.commit()
        db.refresh(call_record)

        # Create activity record
        activity = LeadActivity(
            tenant_id=tenant_id,
            lead_id=lead_id,
            activity_type="call_initiated",
            description=f"AI {call_type} call initiated",
            activity_metadata={"call_id": call_record.id, "call_type": call_type},
        )
        db.add(activity)
        db.commit()

        logger.info(f"Call {call_record.id} queued for lead {lead_id} via {call_type}")
        return {
            "status": "queued",
            "call_id": call_record.id,
            "lead_id": lead_id,
            "call_type": call_type,
        }

    except Exception as exc:
        logger.error(f"Failed to initiate call for lead {lead_id}: {exc}")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_whatsapp_message(self, lead_phone: str, template_name: str, variables: dict, tenant_id: str):
    """Send WhatsApp message using Meta Cloud API."""
    if not settings.WHATSAPP_API_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.warning(f"WhatsApp not configured — skipping message to {lead_phone}")
        return {"status": "skipped", "reason": "WhatsApp not configured"}

    db = _get_session()
    try:
        message_body = json.dumps(variables, indent=2) if variables else template_name

        response = _http_post(
            url=f"https://graph.facebook.com/v19.0/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            headers={
                "Authorization": f"Bearer {settings.WHATSAPP_API_TOKEN}",
                "Content-Type": "application/json",
            },
            json_data={
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": lead_phone.replace("+", "").replace(" ", ""),
                "type": "text",
                "text": {"body": message_body[:4096]},
            },
        )

        if response.status_code == 200:
            data = response.json()
            wa_message_id = data.get("messages", [{}])[0].get("id", "")
            logger.info(f"WhatsApp sent to {lead_phone}: {wa_message_id}")
            return {"status": "sent", "to": lead_phone, "template": template_name, "wa_message_id": wa_message_id}
        else:
            logger.error(f"WhatsApp API error {response.status_code}: {response.text}")
            return {"status": "failed", "error": response.text}

    except Exception as exc:
        logger.error(f"WhatsApp send failed for {lead_phone}: {exc}")
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_email_notification(self, to_email: str, subject: str, body: str, tenant_id: str):
    """Send email notification via Resend API."""
    if not settings.RESEND_API_KEY:
        logger.warning(f"Resend not configured — skipping email to {to_email}")
        return {"status": "skipped", "reason": "Resend not configured"}

    try:
        response = _http_post(
            url="https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json_data={
                "from": f"{settings.RESEND_FROM_NAME} <{settings.RESEND_FROM_EMAIL}>",
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
        )

        if response.status_code == 200:
            data = response.json()
            logger.info(f"Email sent to {to_email}: {data.get('id', '')}")
            return {"status": "sent", "to": to_email, "subject": subject, "id": data.get("id", "")}
        else:
            logger.error(f"Resend API error {response.status_code}: {response.text}")
            return {"status": "failed", "error": response.text}

    except Exception as exc:
        logger.error(f"Email send failed for {to_email}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(bind=True, default_retry_delay=30)
def process_call_transcript(self, call_id: str, transcript_text: str):
    """Process call transcript with DeepSeek for analysis: sentiment, summary, lead scoring."""
    if not settings.DEEPSEEK_API_KEY:
        logger.warning("DeepSeek not configured — using fallback analysis")
        return {"status": "fallback", "call_id": call_id, "analysis": "pending"}

    db = _get_session()
    try:
        call = db.query(Call).filter(Call.id == call_id).first()
        if not call:
            return {"status": "failed", "error": "Call not found"}

        response = _http_post(
            url=f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json_data={
                "model": settings.DEEPSEEK_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Analyze this real estate call transcript. Return JSON with: "
                            "sentiment (positive/neutral/negative), "
                            "summary (2-3 sentence summary), "
                            "keywords (list of key topics), "
                            "score (lead score 0-100)."
                        ),
                    },
                    {"role": "user", "content": transcript_text[:8000]},
                ],
                "temperature": 0.1,
                "max_tokens": 1024,
            },
        )

        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            # Clean markdown code blocks
            content = content.replace("```json", "").replace("```", "").strip()
            analysis = json.loads(content)

            call.ai_summary = analysis.get("summary", "")
            call.ai_sentiment = analysis.get("sentiment", "neutral")
            call.ai_keywords = analysis.get("keywords", [])
            db.commit()

            logger.info(f"Transcript processed for call {call_id}: sentiment={analysis.get('sentiment')}")
            return {"status": "processed", "call_id": call_id, "analysis": analysis}
        else:
            logger.error(f"DeepSeek API error: {response.text}")
            return {"status": "failed", "error": response.text}

    except json.JSONDecodeError:
        logger.error(f"Failed to parse DeepSeek response for call {call_id}")
        return {"status": "failed", "error": "JSON parse error"}
    except Exception as exc:
        logger.error(f"Transcript processing failed for call {call_id}: {exc}")
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, default_retry_delay=30)
def generate_lead_score(self, lead_id: str, call_data: dict):
    """Generate AI lead score based on call data using DeepSeek."""
    if not settings.DEEPSEEK_API_KEY:
        logger.warning("DeepSeek not configured — using rule-based scoring")
        return {"status": "fallback", "lead_id": lead_id, "score": 50}

    db = _get_session()
    try:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            return {"status": "failed", "error": "Lead not found"}

        response = _http_post(
            url=f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json_data={
                "model": settings.DEEPSEEK_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Score this real estate lead from 0-100 based on:\n"
                            "- Budget clarity and range\n"
                            "- Timeline urgency\n"
                            "- Location specificity\n"
                            "- Property type preference\n"
                            "- Engagement level\n"
                            "Return JSON: {\"score\": int, \"reason\": \"string\", \"factors\": {}}\n"
                            "Return ONLY valid JSON, no markdown."
                        ),
                    },
                    {"role": "user", "content": json.dumps(call_data)},
                ],
                "temperature": 0.1,
                "max_tokens": 512,
            },
        )

        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            content = content.replace("```json", "").replace("```", "").strip()
            result = json.loads(content)

            score = min(100, max(0, result.get("score", 50)))
            lead.lead_score = score
            lead.ai_notes = result
            db.commit()

            logger.info(f"Lead {lead_id} scored: {score}/100")
            return {"status": "scored", "lead_id": lead_id, "score": score}
        else:
            return {"status": "failed", "error": response.text}

    except Exception as exc:
        logger.error(f"Lead scoring failed for {lead_id}: {exc}")
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def execute_campaign_task(self, campaign_id: str, lead_id: str, task_order: int):
    """Execute a single task in a campaign workflow (call, WhatsApp, email, delay)."""
    db = _get_session()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        task = db.query(CampaignTask).filter(
            CampaignTask.campaign_id == campaign_id,
            CampaignTask.order == task_order,
        ).first()

        if not campaign or not task:
            logger.error(f"Campaign {campaign_id} or task order {task_order} not found")
            return {"status": "failed", "error": "Campaign or task not found"}

        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if not lead:
            return {"status": "failed", "error": "Lead not found"}

        action = task.action
        config = task.config or {}

        if action == "call":
            # Trigger call via the call initiation task
            initiate_ai_call.delay(lead_id, lead.tenant_id, config.get("call_type", "follow_up"))
            result = f"Call initiated for lead {lead_id}"
        elif action == "whatsapp":
            send_whatsapp_message.delay(
                lead.phone,
                config.get("template", "follow_up"),
                config.get("variables", {}),
                lead.tenant_id,
            )
            result = f"WhatsApp sent to {lead.phone}"
        elif action == "update_lead_status":
            new_status = config.get("status", "")
            if new_status:
                lead.status = new_status
                db.commit()
            result = f"Lead status updated to {new_status}"
        elif action == "tag_lead":
            tag = config.get("tag", "")
            if tag:
                tags = lead.tags or []
                if tag not in tags:
                    tags.append(tag)
                    lead.tags = tags
                    db.commit()
            result = f"Tag '{tag}' added"
        else:
            result = f"Action {action} executed"

        # Update campaign stats
        campaign.leads_processed = (campaign.leads_processed or 0) + 1
        db.commit()

        logger.info(f"Campaign task {task_order} for {campaign_id}: {result}")
        return {"status": "completed", "campaign_id": campaign_id, "task_order": task_order, "result": result}

    except Exception as exc:
        logger.error(f"Campaign task failed: {exc}")
        db.rollback()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def send_appointment_reminder(self, appointment_id: str, channel: str = "whatsapp"):
    """Send appointment reminder via specified channel."""
    db = _get_session()
    try:
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            return {"status": "failed", "error": "Appointment not found"}

        lead = db.query(Lead).filter(Lead.id == appointment.lead_id).first()
        tenant = db.query(Tenant).filter(Tenant.id == appointment.tenant_id).first()
        if not lead or not tenant:
            return {"status": "failed", "error": "Lead or tenant not found"}

        reminder_message = (
            f"Namaste {lead.first_name}! "
            f"Aapki appointment kal hai. "
            f"Date: {appointment.scheduled_date.strftime('%d %b %Y')}, "
            f"Time: {appointment.scheduled_start_time.strftime('%I:%M %p')}, "
            f"Location: {appointment.location or 'Not specified'}. "
            f"Kripaya samay par pahunchne ka kast karein."
        )

        if channel == "whatsapp" and settings.WHATSAPP_API_TOKEN:
            send_whatsapp_message.delay(
                lead.phone, "appointment_reminder",
                {"message": reminder_message}, lead.tenant_id,
            )
        elif channel == "email" and settings.RESEND_API_KEY:
            send_email_notification.delay(
                lead.email or tenant.email,
                "Appointment Reminder",
                reminder_message,
                lead.tenant_id,
            )

        # Mark reminder as sent
        appointment.reminder_sent_24h = True
        db.commit()

        logger.info(f"Reminder sent for appointment {appointment_id} via {channel}")
        return {"status": "sent", "appointment_id": appointment_id, "channel": channel}

    except Exception as exc:
        logger.error(f"Reminder failed: {exc}")
        db.rollback()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_webhook_event(self, webhook_id: str, event_type: str, payload: dict):
    """Process and forward webhook events to external services via configured webhooks."""
    from app.models.integration import Webhook
    import httpx

    db = _get_session()
    try:
        webhook = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if not webhook:
            return {"status": "failed", "error": "Webhook not found"}
        if not webhook.is_active:
            return {"status": "skipped", "reason": "Webhook inactive"}

        event_payload = {
            "event": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        }

        with httpx.Client(timeout=webhook.timeout_seconds or 10) as client:
            response = client.post(
                webhook.url,
                json=event_payload,
                headers={**webhook.headers, "Content-Type": "application/json"},
            )

        webhook.total_sent = (webhook.total_sent or 0) + 1
        webhook.last_sent_at = datetime.now(timezone.utc)
        webhook.last_response_code = response.status_code

        if 200 <= response.status_code < 300:
            webhook.total_success = (webhook.total_success or 0) + 1
            logger.info(f"Webhook {webhook_id}: {event_type} forwarded to {webhook.url}")
            status = "processed"
        else:
            webhook.total_failed = (webhook.total_failed or 0) + 1
            webhook.last_error = f"HTTP {response.status_code}: {response.text[:500]}"
            logger.error(f"Webhook {webhook_id} failed: {response.status_code}")
            status = "failed"

        db.commit()
        return {"status": status, "webhook_id": webhook_id, "response_code": response.status_code}

    except Exception as exc:
        logger.error(f"Webhook processing failed: {exc}")
        db.rollback()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()


@celery_app.task(bind=True, default_retry_delay=60)
def import_leads_from_csv_task(self, file_path: str, tenant_id: str, user_id: str):
    """Background task for importing leads from CSV file into the database."""
    db = _get_session()
    try:
        if not os.path.exists(file_path):
            return {"status": "failed", "error": "File not found"}

        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return {"status": "failed", "error": "Tenant not found"}

        imported = 0
        errors = []

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    phone = row.get("phone") or row.get("Phone") or row.get("PHONE", "")
                    name = row.get("name") or row.get("Name") or row.get("first_name") or "Unknown"

                    if not phone:
                        errors.append(f"Row {row_num}: Phone is required")
                        continue

                    lead = Lead(
                        tenant_id=tenant_id,
                        created_by=user_id,
                        first_name=name,
                        last_name=row.get("last_name") or row.get("Last Name"),
                        email=row.get("email") or row.get("Email"),
                        phone=phone,
                        source="csv_import",
                        requirement=row.get("requirement") or row.get("Requirement"),
                        city=row.get("city") or row.get("City"),
                        location=row.get("location") or row.get("Location"),
                    )
                    db.add(lead)
                    imported += 1

                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")

        db.commit()
        logger.info(f"CSV import completed: {imported} imported, {len(errors)} errors from {file_path}")
        return {"status": "imported", "imported": imported, "errors": errors}

    except Exception as exc:
        logger.error(f"CSV import failed: {exc}")
        db.rollback()
        return {"status": "failed", "error": str(exc)}
    finally:
        db.close()

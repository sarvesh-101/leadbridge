"""LeadFlow AI OS - Unit Tests for Celery Tasks"""

import json
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

import pytest

from app.workers.tasks import (
    initiate_ai_call,
    send_whatsapp_message,
    send_email_notification,
    process_call_transcript,
    generate_lead_score,
    execute_campaign_task,
    send_appointment_reminder,
    process_webhook_event,
    import_leads_from_csv_task,
)
from app.workers import celery_app


# =============================================================================
# initiate_ai_call
# =============================================================================

class TestInitiateAICall:
    def test_lead_not_found(self, mock_db_session):
        """Should return failed when lead doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = initiate_ai_call("lead-001", "tenant-001")
            assert result["status"] == "failed"
            assert "Lead not found" in result["error"]

    def test_tenant_not_found(self, mock_db_session, sample_lead):
        """Should return failed when tenant doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_lead,  # lead found
            None,  # tenant not found
        ]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = initiate_ai_call("lead-001", "tenant-001")
            assert result["status"] == "failed"
            assert "Tenant not found" in result["error"]

    def test_successful_call_initiation(self, mock_db_session, sample_lead, sample_tenant, sample_ai_config):
        """Should queue a call record and create activity."""
        # The call_id is set by db.refresh, so mock that
        def refresh_side_effect(obj):
            obj.id = "call-001"

        mock_db_session.refresh.side_effect = refresh_side_effect
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_lead,  # lead
            sample_tenant,  # tenant
            sample_ai_config,  # ai config
        ]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = initiate_ai_call("lead-001", "tenant-001", "ai")
            assert result["status"] == "queued"
            assert result["call_id"] == "call-001"
            assert result["lead_id"] == "lead-001"
            assert result["call_type"] == "ai"
            assert mock_db_session.add.called
            assert mock_db_session.commit.called

    def test_db_exception_triggers_retry(self, mock_db_session, sample_lead, sample_tenant, sample_ai_config):
        """Should retry on database exception."""
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_lead,
            sample_tenant,
        ]
        mock_db_session.add.side_effect = Exception("DB error")
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch.object(initiate_ai_call, "retry") as mock_retry:
            initiate_ai_call("lead-001", "tenant-001")
            mock_retry.assert_called_once()


# =============================================================================
# send_whatsapp_message
# =============================================================================

class TestSendWhatsAppMessage:
    def test_skipped_when_not_configured(self):
        """Should skip when WhatsApp API is not configured."""
        with patch("app.workers.tasks.settings.WHATSAPP_API_TOKEN", None):
            result = send_whatsapp_message("+919876543210", "test_template", {}, "tenant-001")
            assert result["status"] == "skipped"

    def test_successful_send(self, mock_http_post, mock_db_session):
        """Should send WhatsApp message via Meta Cloud API."""
        with patch("app.workers.tasks.settings.WHATSAPP_API_TOKEN", "test-token"), \
             patch("app.workers.tasks.settings.WHATSAPP_PHONE_NUMBER_ID", "test-phone-id"), \
             patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = send_whatsapp_message("+919876543210", "welcome", {"name": "Rahul"}, "tenant-001")
            assert result["status"] == "sent"
            assert result["to"] == "+919876543210"

    def test_api_error(self, mock_http_post, mock_db_session):
        """Should handle WhatsApp API error."""
        mock_http_post.post.return_value.status_code = 400
        mock_http_post.post.return_value.text = "Bad Request"
        with patch("app.workers.tasks.settings.WHATSAPP_API_TOKEN", "test-token"), \
             patch("app.workers.tasks.settings.WHATSAPP_PHONE_NUMBER_ID", "test-phone-id"), \
             patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = send_whatsapp_message("+919876543210", "welcome", {}, "tenant-001")
            assert result["status"] == "failed"


# =============================================================================
# send_email_notification
# =============================================================================

class TestSendEmailNotification:
    def test_skipped_when_not_configured(self):
        """Should skip when Resend is not configured."""
        with patch("app.workers.tasks.settings.RESEND_API_KEY", None):
            result = send_email_notification("test@example.com", "Test", "Body", "tenant-001")
            assert result["status"] == "skipped"

    def test_successful_send(self, mock_http_post):
        """Should send email via Resend API."""
        with patch("app.workers.tasks.settings.RESEND_API_KEY", "test-key"), \
             patch("app.workers.tasks.settings.RESEND_FROM_EMAIL", "noreply@leadflow.ai"), \
             patch("app.workers.tasks.settings.RESEND_FROM_NAME", "LeadFlow"):
            result = send_email_notification("test@example.com", "Welcome", "Hello!", "tenant-001")
            assert result["status"] == "sent"
            assert result["to"] == "test@example.com"

    def test_api_error(self, mock_http_post):
        """Should handle Resend API error."""
        mock_http_post.post.return_value.status_code = 401
        mock_http_post.post.return_value.text = "Unauthorized"
        with patch("app.workers.tasks.settings.RESEND_API_KEY", "test-key"), \
             patch("app.workers.tasks.settings.RESEND_FROM_EMAIL", "noreply@leadflow.ai"), \
             patch("app.workers.tasks.settings.RESEND_FROM_NAME", "LeadFlow"):
            result = send_email_notification("test@example.com", "Welcome", "Hello!", "tenant-001")
            assert result["status"] == "failed"


# =============================================================================
# process_call_transcript
# =============================================================================

class TestProcessCallTranscript:
    def test_fallback_when_not_configured(self):
        """Should use fallback when DeepSeek is not configured."""
        with patch("app.workers.tasks.settings.DEEPSEEK_API_KEY", None):
            result = process_call_transcript("call-001", "Hello, I am interested in...")
            assert result["status"] == "fallback"

    def test_call_not_found(self, mock_db_session):
        """Should fail when call doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        with patch("app.workers.tasks.settings.DEEPSEEK_API_KEY", "test-key"), \
             patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = process_call_transcript("call-001", "Hello")
            assert result["status"] == "failed"
            assert "Call not found" in result["error"]

    def test_successful_processing(self, mock_db_session, sample_call):
        """Should process transcript and update call with analysis."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_call
        analysis_content = json.dumps({
            "sentiment": "positive",
            "summary": "Lead is interested in 2BHK",
            "keywords": ["2BHK", "Andheri"],
            "score": 75,
        })
        with patch("app.workers.tasks.settings.DEEPSEEK_API_KEY", "test-key"), \
             patch("app.workers.tasks.settings.DEEPSEEK_MODEL", "deepseek-chat"), \
             patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("httpx.Client") as mock_client:
            mock_instance = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{"message": {"content": f"```json\n{analysis_content}\n```"}}]
            }
            mock_instance.post.return_value = mock_response
            mock_client.return_value.__enter__.return_value = mock_instance
            result = process_call_transcript("call-001", "I am looking for a 2BHK in Andheri...")
            assert result["status"] == "processed"
            assert result["analysis"]["sentiment"] == "positive"

    def test_deepseek_api_error(self, mock_db_session, sample_call):
        """Should handle DeepSeek API error."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_call
        with patch("app.workers.tasks.settings.DEEPSEEK_API_KEY", "test-key"), \
             patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("httpx.Client") as mock_client:
            mock_instance = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"
            mock_instance.post.return_value = mock_response
            mock_client.return_value.__enter__.return_value = mock_instance
            result = process_call_transcript("call-001", "Hello")
            assert result["status"] == "failed"


# =============================================================================
# generate_lead_score
# =============================================================================

class TestGenerateLeadScore:
    def test_fallback_when_not_configured(self):
        """Should use fallback when DeepSeek is not configured."""
        with patch("app.workers.tasks.settings.DEEPSEEK_API_KEY", None):
            result = generate_lead_score("lead-001", {"budget": "50L"})
            assert result["status"] == "fallback"
            assert result["score"] == 50

    def test_lead_not_found(self, mock_db_session):
        """Should fail when lead doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        with patch("app.workers.tasks.settings.DEEPSEEK_API_KEY", "test-key"), \
             patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = generate_lead_score("lead-001", {})
            assert result["status"] == "failed"

    def test_successful_scoring(self, mock_db_session, sample_lead):
        """Should generate score and update lead."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_lead
        score_response = json.dumps({"score": 85, "reason": "High budget", "factors": {"budget": "high"}})
        with patch("app.workers.tasks.settings.DEEPSEEK_API_KEY", "test-key"), \
             patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("httpx.Client") as mock_client:
            mock_instance = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "choices": [{"message": {"content": score_response}}]
            }
            mock_instance.post.return_value = mock_response
            mock_client.return_value.__enter__.return_value = mock_instance
            result = generate_lead_score("lead-001", {"budget": "1Cr"})
            assert result["status"] == "scored"
            assert result["score"] == 85
            assert sample_lead.lead_score == 85


# =============================================================================
# execute_campaign_task
# =============================================================================

class TestExecuteCampaignTask:
    def test_campaign_not_found(self, mock_db_session):
        """Should fail when campaign doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [None]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = execute_campaign_task("camp-001", "lead-001", 1)
            assert result["status"] == "failed"

    def test_call_action(self, mock_db_session, sample_lead):
        """Should trigger call initiation for call action."""
        mock_campaign = MagicMock()
        mock_campaign.id = "camp-001"
        mock_campaign.leads_processed = 0
        mock_task = MagicMock()
        mock_task.order = 1
        mock_task.action = "call"
        mock_task.config = {"call_type": "follow_up"}

        # Return campaign, task, lead
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            mock_campaign, mock_task, sample_lead,
        ]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.initiate_ai_call.delay") as mock_call:
            result = execute_campaign_task("camp-001", "lead-001", 1)
            assert result["status"] == "completed"
            mock_call.assert_called_once_with("lead-001", "tenant-001", "follow_up")

    def test_whatsapp_action(self, mock_db_session, sample_lead):
        """Should trigger WhatsApp send for whatsapp action."""
        mock_campaign = MagicMock()
        mock_campaign.id = "camp-001"
        mock_campaign.leads_processed = 0
        mock_task = MagicMock()
        mock_task.order = 1
        mock_task.action = "whatsapp"
        mock_task.config = {"template": "follow_up", "variables": {}}

        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            mock_campaign, mock_task, sample_lead,
        ]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.send_whatsapp_message.delay") as mock_wa:
            result = execute_campaign_task("camp-001", "lead-001", 1)
            assert result["status"] == "completed"
            mock_wa.assert_called_once()

    def test_update_lead_status_action(self, mock_db_session, sample_lead):
        """Should update lead status for update_lead_status action."""
        mock_campaign = MagicMock()
        mock_campaign.id = "camp-001"
        mock_campaign.leads_processed = 0
        mock_task = MagicMock()
        mock_task.order = 1
        mock_task.action = "update_lead_status"
        mock_task.config = {"status": "contacted"}

        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            mock_campaign, mock_task, sample_lead,
        ]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = execute_campaign_task("camp-001", "lead-001", 1)
            assert result["status"] == "completed"
            assert sample_lead.status == "contacted"


# =============================================================================
# send_appointment_reminder
# =============================================================================

class TestSendAppointmentReminder:
    def test_appointment_not_found(self, mock_db_session):
        """Should fail when appointment doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = send_appointment_reminder("apt-001")
            assert result["status"] == "failed"
            assert "Appointment not found" in result["error"]

    def test_successful_whatsapp_reminder(self, mock_db_session, sample_lead, sample_tenant, sample_appointment):
        """Should send WhatsApp reminder."""
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_appointment, sample_lead, sample_tenant,
        ]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.settings.WHATSAPP_API_TOKEN", "test-token"), \
             patch("app.workers.tasks.send_whatsapp_message.delay") as mock_wa:
            result = send_appointment_reminder("apt-001", "whatsapp")
            assert result["status"] == "sent"
            mock_wa.assert_called_once()

    def test_reminder_marked_sent(self, mock_db_session, sample_lead, sample_tenant, sample_appointment):
        """Should mark reminder_sent_24h as True."""
        mock_db_session.query.return_value.filter.return_value.first.side_effect = [
            sample_appointment, sample_lead, sample_tenant,
        ]
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.settings.WHATSAPP_API_TOKEN", "test-token"), \
             patch("app.workers.tasks.send_whatsapp_message.delay"):
            result = send_appointment_reminder("apt-001", "whatsapp")
            assert result["status"] == "sent"
            assert sample_appointment.reminder_sent_24h is True


# =============================================================================
# process_webhook_event
# =============================================================================

class TestProcessWebhookEvent:
    def test_webhook_not_found(self, mock_db_session):
        """Should fail when webhook doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = process_webhook_event("wh-001", "lead.created", {"id": "lead-001"})
            assert result["status"] == "failed"

    def test_inactive_webhook(self, mock_db_session):
        """Should skip when webhook is inactive."""
        mock_webhook = MagicMock()
        mock_webhook.is_active = False
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_webhook
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session):
            result = process_webhook_event("wh-001", "lead.created", {})
            assert result["status"] == "skipped"

    def test_successful_forward(self, mock_db_session):
        """Should forward event to webhook URL and track success."""
        mock_webhook = MagicMock()
        mock_webhook.is_active = True
        mock_webhook.url = "https://example.com/webhook"
        mock_webhook.headers = {"X-Auth": "token"}
        mock_webhook.timeout_seconds = 10
        mock_webhook.total_sent = 0
        mock_webhook.total_success = 0
        mock_webhook.total_failed = 0
        mock_webhook.last_response_code = None
        mock_webhook.last_error = None
        mock_webhook.last_sent_at = None
        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_webhook
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("httpx.Client") as mock_client:
            mock_instance = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_instance.post.return_value = mock_response
            mock_client.return_value.__enter__.return_value = mock_instance
            result = process_webhook_event("wh-001", "lead.created", {"id": "lead-001"})
            assert result["status"] == "processed"
            assert mock_webhook.total_sent == 1
            assert mock_webhook.total_success == 1


# =============================================================================
# import_leads_from_csv_task
# =============================================================================

class TestImportLeadsFromCSV:
    def test_file_not_found(self, mock_db_session):
        """Should fail when CSV file doesn't exist."""
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.os.path.exists", return_value=False):
            result = import_leads_from_csv_task("/nonexistent/file.csv", "tenant-001", "user-001")
            assert result["status"] == "failed"
            assert "File not found" in result["error"]

    def test_tenant_not_found(self, mock_db_session):
        """Should fail when tenant doesn't exist."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = None
        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.os.path.exists", return_value=True):
            result = import_leads_from_csv_task("/fake/file.csv", "tenant-001", "user-001")
            assert result["status"] == "failed"
            assert "Tenant not found" in result["error"]

    def test_successful_import(self, mock_db_session, sample_tenant):
        """Should import leads from CSV."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_tenant

        csv_content = "name,phone,email,city\nRahul,+919876543210,rahul@test.com,Mumbai\nPriya,+919876543211,priya@test.com,Delhi\n"

        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.os.path.exists", return_value=True), \
             patch("builtins.open") as mock_open:
            mock_file = MagicMock()
            mock_file.__enter__.return_value = csv_content.splitlines(True)
            mock_open.return_value = mock_file
            result = import_leads_from_csv_task("/fake/leads.csv", "tenant-001", "user-001")
            assert result["status"] == "imported"
            assert result["imported"] == 2
            assert len(result["errors"]) == 0

    def test_skips_rows_without_phone(self, mock_db_session, sample_tenant):
        """Should skip CSV rows without phone number."""
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_tenant

        csv_content = "name,phone,email\nRahul,,rahul@test.com\nPriya,+919876543211,priya@test.com\n"

        with patch("app.workers.tasks.SyncSessionLocal", return_value=mock_db_session), \
             patch("app.workers.tasks.os.path.exists", return_value=True), \
             patch("builtins.open") as mock_open:
            mock_file = MagicMock()
            mock_file.__enter__.return_value = csv_content.splitlines(True)
            mock_open.return_value = mock_file
            result = import_leads_from_csv_task("/fake/leads.csv", "tenant-001", "user-001")
            assert result["status"] == "imported"
            assert result["imported"] == 1
            assert len(result["errors"]) == 1

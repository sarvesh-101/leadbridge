/**
 * Shared forwarded-SMS processing — used by BOTH SMS providers:
 *   - Twilio (POST /webhooks/sms/incoming)
 *   - MessageBird (POST /webhooks/sms/incoming-messagebird)
 *
 * Pipeline: identify the broker by sender number → parse the portal SMS (regex
 * + LLM fallback) → enforce limits → dedup → create lead → queue AI call.
 *
 * Brokers forward their portal enquiry SMS (99acres, JustDial, MagicBricks…)
 * to a Converza number; the provider POSTs it here and a lead is born.
 */
import { FastifyInstance } from "fastify";
import { parseSmsLead, parseSmsLeadWithConfidence } from "../utils/sms-lead-parser";
import { normalizePhone } from "../utils/phone";
import { enqueueCall } from "../workers/queues";
import { emitNewLead } from "../services/websocket.service";
import { tryAcquireLock, releaseLock } from "../utils/distributed-lock";
import { logger } from "../utils/logger";

export interface ForwardedSmsParams {
  /** Sender number (E.164 international format, e.g. +919876543210) */
  from: string;
  /** Message text */
  body: string;
  /** Our receiving number (optional) */
  to?: string;
  /** Provider message id (Twilio MessageSid / MessageBird id) */
  messageId?: string;
  /** Provider label for logs: "Twilio" | "MessageBird" */
  provider: string;
}

export type ForwardedSmsResult =
  | { status: "created"; leadId: string }
  | { status: "duplicate" }
  | { status: "ignored"; reason: string };

/**
 * Process a forwarded SMS end-to-end. Returns a summary for the caller; the
 * caller decides the HTTP response (providers expect 200 for handled events).
 */
export async function processForwardedSms(
  fastify: FastifyInstance,
  params: ForwardedSmsParams
): Promise<ForwardedSmsResult> {
  const { from, body, to, messageId, provider } = params;
  const requestId = (fastify as unknown as Record<string, unknown>).requestId || "sms-no-id";

  if (!from || !body) {
    logger.warn({ requestId }, `[${provider}] Missing from or body — ignoring`);
    return { status: "ignored", reason: "missing_fields" };
  }

  // ─── Look up broker by phone number ──────────────────────────
  let client = await fastify.prisma.client.findFirst({
    where: {
      OR: [
        { phone: from },
        { phone: from.replace(/\D/g, "").slice(-10) },
        { ownerWhatsapp: { contains: from.replace(/\D/g, "").slice(-10) } },
      ],
    },
    select: {
      id: true,
      businessName: true,
      plan: true,
      planStatus: true,
      callsThisMonth: true,
      callsLimit: true,
      phone: true,
      ownerWhatsapp: true,
    },
  });

  if (!client) {
    try {
      const normalizedFrom = normalizePhone(from);
      client = await fastify.prisma.client.findFirst({
        where: { OR: [{ phone: normalizedFrom }, { ownerWhatsapp: normalizedFrom }] },
        select: {
          id: true,
          businessName: true,
          plan: true,
          planStatus: true,
          callsThisMonth: true,
          callsLimit: true,
          leadsThisMonth: true,
          phone: true,
          ownerWhatsapp: true,
        },
      });
    } catch {
      // normalizePhone can throw for invalid numbers
    }
  }

  if (!client) {
    logger.warn({ from, requestId }, `[${provider}] No broker found for this number — ignoring`);
    return { status: "ignored", reason: "no_broker" };
  }

  if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
    logger.warn({ clientId: client.id, planStatus: client.planStatus, requestId }, `[${provider}] Broker account inactive`);
    return { status: "ignored", reason: "inactive" };
  }

  // ─── Parse the SMS body ────────────────────────────────────
  let parsed = parseSmsLead(body);
  let confidence = 0.5;

  if (!parsed || !parsed.phone) {
    logger.info({ clientId: client.id, body: body.substring(0, 100), requestId }, `[${provider}] Regex parse failed — trying LLM fallback`);
    try {
      const { extractLeadFromForwardedText } = await import("../services/deepseek.service");
      const llmResult = await extractLeadFromForwardedText(body, "sms");
      if (llmResult) {
        parsed = {
          name: llmResult.name || "Unknown",
          phone: llmResult.phone,
          email: llmResult.email,
          source: "sms_forward",
          budget: llmResult.budget,
          location: llmResult.location,
          propertyType: llmResult.propertyType,
          bedrooms: llmResult.bedrooms,
        };
        confidence = 0.7;
      }
    } catch (err: any) {
      logger.warn({ clientId: client.id, err: err.message, requestId }, `[${provider}] LLM fallback extraction failed`);
    }
  }

  if (!parsed || !parsed.phone) {
    logger.warn({ clientId: client.id, body: body.substring(0, 150), requestId }, `[${provider}] Could not parse lead from SMS`);
    return { status: "ignored", reason: "unparseable" };
  }

  if (confidence === 0.5) {
    confidence = parseSmsLeadWithConfidence(body).confidence;
  }

  // ─── Monthly leads cap ────────────────────────────────────
  const { checkMonthlyLeadsCapacity, tryConsumeMonthlyLead } = await import("../utils/lead-limits");
  const monthlyLeads = await checkMonthlyLeadsCapacity(fastify.prisma, client.id, client.plan);
  if (!monthlyLeads.canIngest) {
    logger.warn({ clientId: client.id, requestId }, `[${provider}] Forwarded SMS ignored — monthly lead limit reached`);
    fastify.prisma.ownerNotification
      .create({
        data: {
          clientId: client.id,
          type: "LEAD_LIMIT",
          message: `A forwarded SMS lead (${parsed.name || "new lead"}) was not added — your monthly lead limit (${monthlyLeads.limit}) is reached. Upgrade your plan to add more leads.`,
          status: "sent",
          sentAt: new Date(),
        },
      })
      .catch(() => {});
    return { status: "ignored", reason: "monthly_limit" };
  }

  const callAllowed = client.plan === "PRO" || client.callsThisMonth < client.callsLimit;

  // ─── Create lead with distributed lock for dedup safety ──────
  const dedupLockId = `dedup:${client.id}:${parsed.phone}`;
  const lockAcquired = await tryAcquireLock(fastify, dedupLockId, 5);

  let lead: any;
  try {
    if (lockAcquired) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const existing = await fastify.prisma.lead.findFirst({
        where: {
          clientId: client.id,
          phone: parsed.phone,
          receivedAt: { gte: thirtyDaysAgo },
          status: { notIn: ["COLD", "CONVERTED"] },
        },
      });

      if (existing) {
        logger.info({ clientId: client.id, leadId: existing.id, phone: parsed.phone, requestId }, `[${provider}] Duplicate lead — skipped`);
        return { status: "duplicate" };
      }

      lead = await createLead();
    } else {
      lead = await createLead();
    }
  } finally {
    if (lockAcquired) {
      await releaseLock(fastify, dedupLockId);
    }
  }

  async function createLead() {
    return fastify.prisma.lead.create({
      data: {
        clientId: client!.id,
        name: parsed!.name,
        phone: parsed!.phone,
        email: parsed!.email || null,
        source: "sms_forward",
        portalSource: parsed!.source,
        budget: parsed!.budget || null,
        location: parsed!.location || null,
        propertyType: parsed!.propertyType || null,
        bedrooms: parsed!.bedrooms || null,
        status: "PENDING",
        receivedAt: new Date(),
        rawPayload: {
          smsBody: body,
          fromNumber: from,
          toNumber: to,
          messageId,
          provider,
          portalDetected: parsed!.source,
          parsedAt: new Date().toISOString(),
          parseConfidence: confidence,
        },
      },
    });
  }

  if (!lead) {
    logger.error({ clientId: client.id, requestId }, `[${provider}] Failed to create lead`);
    return { status: "ignored", reason: "creation_failed" };
  }

  await tryConsumeMonthlyLead(fastify.prisma, client.id, client.plan);

  logger.info({ clientId: client.id, leadId: lead.id, phone: parsed.phone, source: parsed.source, requestId },
    `[${provider}] Lead created from forwarded SMS`);

  // ─── Background: auto-assign, property match, enqueue call ──
  Promise.allSettled([
    (async () => {
      try {
        const { assignLead } = await import("../services/lead-assignment.service");
        await assignLead(client!.id, lead.id);
      } catch { /* non-blocking */ }
    })(),
    (async () => {
      try {
        const { matchLeadToProperties } = await import("../services/property-matching.service");
        await matchLeadToProperties(lead.id, client!.id);
      } catch { /* non-blocking */ }
    })(),
    (async () => {
      try {
        if (callAllowed) {
          await enqueueCall({ leadId: lead.id, clientId: client!.id, callType: "QUALIFICATION", attempt: 1 });
        } else {
          await fastify.prisma.ownerNotification
            .create({
              data: {
                clientId: client!.id,
                leadId: lead.id,
                type: "CALL_SKIPPED_LIMIT",
                message: `New forwarded SMS lead (${parsed.name}) received — AI call skipped because your monthly call limit is reached. Upgrade to resume AI calls.`,
                status: "sent",
                sentAt: new Date(),
              },
            })
            .catch(() => {});
          logger.warn({ clientId: client!.id, leadId: lead.id, requestId }, `[${provider}] Lead stored but AI call skipped — call limit reached`);
        }
      } catch { /* non-blocking */ }
    })(),
    (async () => {
      try {
        await emitNewLead(lead.id, lead.name, parsed.source, client!.id);
      } catch { /* non-blocking */ }
    })(),
  ]);

  return { status: "created", leadId: lead.id };
}
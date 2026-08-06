/**
 * SMS Forwarding Webhook — receives forwarded SMS from Twilio.
 *
 * POST /api/v1/webhooks/sms/incoming
 *
 * How it works:
 *   1. Broker forwards a portal SMS (99acres, MagicBricks, etc.) to LeadBridge's Twilio number
 *   2. Twilio POSTs the message to this endpoint with `From` (broker's number) and `Body` (SMS text)
 *   3. We look up the broker by their phone/ownerWhatsapp number
 *   4. We parse the SMS body to extract lead info (name, phone, budget, etc.)
 *   5. A new lead is created and the AI call pipeline is triggered
 *
 * Twilio sends: application/x-www-form-urlencoded with fields: From, To, Body, MessageSid
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { parseSmsLead, parseSmsLeadWithConfidence } from "../../utils/sms-lead-parser";
import { normalizePhone } from "../../utils/phone";
import { enqueueCall } from "../../workers/queues";
import { emitNewLead } from "../../services/websocket.service";
import { tryAcquireLock, releaseLock } from "../../utils/distributed-lock";
import { config } from "../../config";
import { logger } from "../../utils/logger";

/** Twilio's incoming SMS webhook payload */
interface TwilioSmsPayload {
  From?: string;
  To?: string;
  Body?: string;
  MessageSid?: string;
  SmsSid?: string;
  SmsStatus?: string;
  AccountSid?: string;
  MessagingServiceSid?: string;
}

/**
 * Validate Twilio webhook signature to ensure the request is genuinely from Twilio.
 * Uses the Twilio Auth Token from config.
 */
function validateTwilioRequest(url: string, params: Record<string, string>, signature: string | undefined): boolean {
  if (!signature) return false;
  const authToken = config.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  // Build the signature string per Twilio spec: URL + sorted key-value pairs
  const sortedKeys = Object.keys(params).sort();
  let sigString = url;
  for (const key of sortedKeys) {
    sigString += key + params[key];
  }
  // Compute HMAC-SHA1 with auth token
  const computed = crypto.createHmac("sha1", authToken).update(sigString).digest("base64");
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export default async function smsForwardingRoutes(fastify: FastifyInstance) {
  // ─── Incoming SMS from Twilio ──────────────────────────────────
  // Twilio sends form-encoded POST data. Rate limited to prevent abuse.
  fastify.post("/webhooks/sms/incoming", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: TwilioSmsPayload }>, reply: FastifyReply) => {
    const { From, Body, To, MessageSid } = request.body;
    const xTwilioSignature = request.headers["x-twilio-signature"] as string | undefined;

    // Validate Twilio signature (only if TWILIO_AUTH_TOKEN is configured)
    if (config.TWILIO_AUTH_TOKEN) {
      const fullUrl = `${request.protocol}://${request.hostname}${request.url}`;
      const params = request.body as Record<string, string>;
      if (!validateTwilioRequest(fullUrl, params, xTwilioSignature)) {
        logger.warn({ requestId: (request as any).requestId }, "[SMS] Invalid Twilio signature — rejecting");
        return reply.status(403).send({ error: "Invalid signature" });
      }
    }
    const requestId = (request as unknown as Record<string, unknown>).requestId || "sms-no-id";

    logger.info({ from: From, to: To, msgId: MessageSid, bodyLen: Body?.length }, `[SMS] Incoming forwarded SMS ${requestId}`);

    if (!From || !Body) {
      logger.warn({ requestId }, "[SMS] Missing From or Body — ignoring");
      return reply.status(200).type("text/xml").send("<Response></Response>");
    }

    // ─── Look up broker by phone number ──────────────────────────
    // Brokers can be matched by their registered phone number or ownerWhatsapp.
    // Try exact match first, then normalized match.
    let client = await fastify.prisma.client.findFirst({
      where: {
        OR: [
          { phone: From },
          { phone: From.replace(/\D/g, "").slice(-10) },
          { ownerWhatsapp: { contains: From.replace(/\D/g, "").slice(-10) } },
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
      // Try with full normalization
      try {
        const normalizedFrom = normalizePhone(From);
        client = await fastify.prisma.client.findFirst({
          where: {
            OR: [
              { phone: normalizedFrom },
              { ownerWhatsapp: normalizedFrom },
            ],
          },
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
      logger.warn({ from: From, requestId }, "[SMS] No broker found for this number — ignoring");
      return reply.status(200).type("text/xml").send("<Response></Response>");
    }

    // Check account is active
    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      logger.warn({ clientId: client.id, planStatus: client.planStatus, requestId }, "[SMS] Broker account inactive");
      return reply.status(200).type("text/xml").send("<Response></Response>");
    }

    // ─── Parse the SMS body ────────────────────────────────────
    const parsed = parseSmsLead(Body);
    if (!parsed || !parsed.phone) {
      logger.warn({ clientId: client.id, body: Body.substring(0, 150), requestId }, "[SMS] Could not parse lead from SMS");
      return reply.status(200).type("text/xml").send("<Response></Response>");
    }

    const { confidence } = parseSmsLeadWithConfidence(Body);

    // FIX Round-2 #6: monthly leads cap (plan.leads) — return empty TwiML so
    // Twilio doesn't retry, but log it so the platform can see over-cap traffic.
    const { checkMonthlyLeadsCapacity, tryConsumeMonthlyLead } = await import("../../utils/lead-limits");
    const monthlyLeads = await checkMonthlyLeadsCapacity(fastify.prisma, client.id, client.plan);
    if (!monthlyLeads.canIngest) {
      // FIX Round-2 #6 (reviewer): don't drop silently — tell the broker why.
      logger.warn({ clientId: client.id, requestId }, "[SMS] Forwarded SMS ignored — monthly lead limit reached");
      fastify.prisma.ownerNotification.create({
        data: {
          clientId: client.id,
          type: "LEAD_LIMIT",
          message: `A forwarded SMS lead (${parsed.name || "new lead"}) was not added — your monthly lead limit (${monthlyLeads.limit}) is reached. Upgrade your plan to add more leads.`,
          status: "sent",
          sentAt: new Date(),
        },
      }).catch(() => {});
      return reply.status(200).type("text/xml").send("<Response></Response>");
    }

    // FIX P0-3: Call quota check — leads are ALWAYS stored. If the broker is
    // out of monthly calls, the lead is kept and only the auto-call is skipped
    // (with an owner notification), instead of silently dropping forwarded SMS.
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
          logger.info({ clientId: client.id, leadId: existing.id, phone: parsed.phone, requestId }, "[SMS] Duplicate lead — skipped");
          return reply.status(200).type("text/xml").send("<Response></Response>");
        }

        lead = await fastify.prisma.lead.create({
          data: {
            clientId: client.id,
            name: parsed.name,
            phone: parsed.phone,
            email: parsed.email || null,
            source: "sms_forward",
            portalSource: parsed.source,
            budget: parsed.budget || null,
            location: parsed.location || null,
            propertyType: parsed.propertyType || null,
            bedrooms: parsed.bedrooms || null,
            status: "PENDING",
            receivedAt: new Date(),
            rawPayload: {
              smsBody: Body,
              fromNumber: From,
              toNumber: To,
              messageSid: MessageSid,
              portalDetected: parsed.source,
              parsedAt: new Date().toISOString(),
              parseConfidence: confidence,
            },
          },
        });
      } else {
        // Fallback without lock (unlikely during forward)
        lead = await fastify.prisma.lead.create({
          data: {
            clientId: client.id,
            name: parsed.name,
            phone: parsed.phone,
            email: parsed.email || null,
            source: "sms_forward",
            portalSource: parsed.source,
            budget: parsed.budget || null,
            location: parsed.location || null,
            propertyType: parsed.propertyType || null,
            bedrooms: parsed.bedrooms || null,
            status: "PENDING",
            receivedAt: new Date(),
            rawPayload: {
              smsBody: Body,
              fromNumber: From,
              toNumber: To,
              messageSid: MessageSid,
              portalDetected: parsed.source,
              parsedAt: new Date().toISOString(),
              parseConfidence: confidence,
            },
          },
        });
      }
    } finally {
      if (lockAcquired) {
        await releaseLock(fastify, dedupLockId);
      }
    }

    if (!lead) {
      logger.error({ clientId: client.id, requestId }, "[SMS] Failed to create lead");
      return reply.status(200).type("text/xml").send("<Response></Response>");
    }

    // FIX Round-2 #6: consume monthly leads allowance (race-safe)
    await tryConsumeMonthlyLead(fastify.prisma, client.id, client.plan);

    logger.info({ clientId: client.id, leadId: lead.id, phone: parsed.phone, source: parsed.source, requestId },
      `[SMS] Lead created from forwarded SMS`);

    // ─── Background: auto-assign, property match, enqueue call ──
    Promise.allSettled([
      (async () => {
        try {
          const { assignLead } = await import("../../services/lead-assignment.service");
          await assignLead(client!.id, lead.id);
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          const { matchLeadToProperties } = await import("../../services/property-matching.service");
          await matchLeadToProperties(lead.id, client!.id);
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          if (callAllowed) {
            await enqueueCall({
              leadId: lead.id,
              clientId: client!.id,
              callType: "QUALIFICATION",
              attempt: 1,
            });
          } else {
            await fastify.prisma.ownerNotification.create({
              data: {
                clientId: client!.id,
                leadId: lead.id,
                type: "CALL_SKIPPED_LIMIT",
                message: `New forwarded SMS lead (${parsed.name}) received — AI call skipped because your monthly call limit is reached. Upgrade to resume AI calls.`,
                status: "sent",
                sentAt: new Date(),
              },
            }).catch(() => {});
            logger.warn({ clientId: client!.id, leadId: lead.id, requestId }, "[SMS] Lead stored but AI call skipped — call limit reached");
          }
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          await emitNewLead(lead.id, lead.name, parsed.source, client!.id);
        } catch { /* non-blocking */ }
      })(),
    ]);

    // ─── Return success to Twilio ──────────────────────────────
    // Twilio expects a 200 OK — empty TwiML response is fine
    return reply.status(200).type("text/xml").send("<Response></Response>");
  });

  // ─── Health check for SMS forwarding ─────────────────────────
  fastify.get("/webhooks/sms/status", async () => {
    const forwardingNumber = process.env.FORWARDING_SMS_NUMBER || "";
    return {
      configured: !!forwardingNumber,
      forwardingNumber,
      message: forwardingNumber
        ? "SMS forwarding active. Brokers can forward portal SMS to this number."
        : "Set FORWARDING_SMS_NUMBER in .env to enable SMS forwarding.",
    };
  });
}

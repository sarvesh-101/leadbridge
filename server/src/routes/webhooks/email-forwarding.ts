/**
 * Email Forwarding Webhook — receives forwarded portal emails.
 *
 * POST /api/v1/webhooks/email/incoming
 *
 * Works with email forwarding services like:
 *   - SendGrid Inbound Parse
 *   - Mailgun Routes
 *   - CloudMailin
 *   - Forward Email
 *
 * How it works:
 *   1. Broker forwards a portal email to LeadBridge's forwarding email
 *   2. The email service POSTs the parsed email to this endpoint
 *   3. We identify the broker by the sender email (From)
 *   4. We parse the email body to extract lead info
 *   5. A new lead is created and the AI call pipeline is triggered
 *
 * Accepts both JSON (modern email services) and form-encoded (SendGrid legacy).
 * Also supports a simpler direct-endpoint for manual/testing purposes.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { parseSmsLead } from "../../utils/sms-lead-parser";
import { enqueueCall } from "../../workers/queues";
import { emitNewLead } from "../../services/websocket.service";
import { tryAcquireLock, releaseLock } from "../../utils/distributed-lock";
import { logger } from "../../utils/logger";

/** Generic email forwarding payload (normalized from multiple providers) */
interface EmailForwardPayload {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
  // SendGrid specific
  from_parsed?: string;
  to_parsed?: string;
  // Mailgun specific
  From?: string;
  To?: string;
  Subject?: string;
  "body-plain"?: string;
  "stripped-text"?: string;
  // Generic
  sender?: string;
  envelope?: string;
}

/**
 * Extract the actual email address from a "Name <email>" format string.
 */
function extractEmail(input: string): string | null {
  if (!input) return null;
  const match = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

/**
 * Extract the email body text from various email service formats.
 */
function extractBody(payload: EmailForwardPayload): string {
  // Try various fields that different email services use
  return payload.text ||
         payload["body-plain"] ||
         payload["stripped-text"] ||
         payload.html?.replace(/<[^>]+>/g, "").trim() ||
         "";
}

export default async function emailForwardingRoutes(fastify: FastifyInstance) {
  // ─── Incoming Email from forwarding service ────────────────────
  fastify.post("/webhooks/email/incoming", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: EmailForwardPayload }>, reply: FastifyReply) => {
    const payload = request.body;
    const requestId = (request as unknown as Record<string, unknown>).requestId || "email-no-id";

    // Extract sender email (try multiple field names)
    const senderEmail = extractEmail(payload.from || payload.From || payload.sender || "");
    const emailSubject = payload.subject || payload.Subject || "";
    const emailBody = extractBody(payload);

    logger.info({ from: senderEmail, subject: emailSubject?.substring(0, 80), bodyLen: emailBody.length },
      `[EMAIL] Incoming forwarded email ${requestId}`);

    if (!senderEmail) {
      logger.warn({ requestId }, "[EMAIL] Could not extract sender email — ignoring");
      return reply.status(200).send({ status: "ignored", reason: "no_sender" });
    }

    if (!emailBody && !emailSubject) {
      logger.warn({ requestId }, "[EMAIL] Empty body and subject — ignoring");
      return reply.status(200).send({ status: "ignored", reason: "empty" });
    }

    // ─── Look up broker by email ─────────────────────────────────
    const client = await fastify.prisma.client.findFirst({
      where: { email: { equals: senderEmail, mode: "insensitive" } },
      select: {
        id: true,
        businessName: true,
        plan: true,
        planStatus: true,
        callsThisMonth: true,
        callsLimit: true,
        email: true,
      },
    });

    if (!client) {
      logger.warn({ from: senderEmail, requestId }, "[EMAIL] No broker found for this email — ignoring");
      return reply.status(200).send({ status: "ignored", reason: "no_broker" });
    }

    // Check account is active
    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      logger.warn({ clientId: client.id, planStatus: client.planStatus, requestId }, "[EMAIL] Broker account inactive");
      return reply.status(200).send({ status: "ignored", reason: "inactive" });
    }

    // ─── Parse the email body ──────────────────────────────────
    // Use the SMS lead parser — email bodies from portals have similar formats
    const searchText = `${emailSubject} ${emailBody}`;
    const parsed = parseSmsLead(searchText);

    if (!parsed || !parsed.phone) {
      logger.warn({ clientId: client.id, subject: emailSubject?.substring(0, 80), requestId },
        "[EMAIL] Could not parse lead from email");
      return reply.status(200).send({ status: "ignored", reason: "unparseable" });
    }

    // ─── Check call limits ─────────────────────────────────────
    if (client.plan !== "PRO" && client.callsThisMonth >= client.callsLimit) {
      logger.warn({ clientId: client.id, callsThisMonth: client.callsThisMonth, requestId },
        "[EMAIL] Broker call limit reached");
      return reply.status(200).send({ status: "ignored", reason: "limit_reached" });
    }

    // ─── Create lead with distributed lock ───────────────────────
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
          logger.info({ clientId: client.id, leadId: existing.id, phone: parsed.phone, requestId },
            "[EMAIL] Duplicate lead — skipped");
          return reply.status(200).send({ status: "skipped", reason: "duplicate", leadId: existing.id });
        }

        lead = await fastify.prisma.lead.create({
          data: {
            clientId: client.id,
            name: parsed.name,
            phone: parsed.phone,
            email: parsed.email || null,
            source: "email_forward",
            portalSource: parsed.source,
            budget: parsed.budget || null,
            location: parsed.location || null,
            propertyType: parsed.propertyType || null,
            bedrooms: parsed.bedrooms || null,
            status: "PENDING",
            receivedAt: new Date(),
            rawPayload: {
              emailSubject,
              senderEmail,
              bodyPreview: emailBody.substring(0, 500),
              portalDetected: parsed.source,
              parsedAt: new Date().toISOString(),
            },
          },
        });
      } else {
        lead = await fastify.prisma.lead.create({
          data: {
            clientId: client.id,
            name: parsed.name,
            phone: parsed.phone,
            email: parsed.email || null,
            source: "email_forward",
            portalSource: parsed.source,
            budget: parsed.budget || null,
            location: parsed.location || null,
            propertyType: parsed.propertyType || null,
            bedrooms: parsed.bedrooms || null,
            status: "PENDING",
            receivedAt: new Date(),
            rawPayload: {
              emailSubject,
              senderEmail,
              bodyPreview: emailBody.substring(0, 500),
              portalDetected: parsed.source,
              parsedAt: new Date().toISOString(),
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
      logger.error({ clientId: client.id, requestId }, "[EMAIL] Failed to create lead");
      return reply.status(200).send({ status: "error", reason: "creation_failed" });
    }

    logger.info({ clientId: client.id, leadId: lead.id, phone: parsed.phone, source: parsed.source, requestId },
      `[EMAIL] Lead created from forwarded email`);

    // ─── Background: auto-assign, property match, enqueue call ──
    Promise.allSettled([
      (async () => {
        try {
          const { assignLead } = await import("../../services/lead-assignment.service");
          await assignLead(client.id, lead.id);
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          const { matchLeadToProperties } = await import("../../services/property-matching.service");
          await matchLeadToProperties(lead.id, client.id);
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          await enqueueCall({
            leadId: lead.id,
            clientId: client.id,
            callType: "QUALIFICATION",
            attempt: 1,
          });
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          await emitNewLead(lead.id, lead.name, parsed.source, client.id);
        } catch { /* non-blocking */ }
      })(),
    ]);

    return reply.status(200).send({
      status: "created",
      leadId: lead.id,
      name: parsed.name,
    });
  });

  // ─── Simple text-based lead creation (for testing/manual use) ─
  // Brokers can also POST lead text directly if they prefer:
  // POST /webhooks/email/incoming  { from, text: "Rahul 9876543210 2BHK Andheri" }
  // This is the same endpoint, just accepts a simpler { from, text } format too.

  // ─── Health check for email forwarding ────────────────────────
  fastify.get("/webhooks/email/status", async () => {
    const forwardingEmail = process.env.FORWARDING_EMAIL || "";
    return {
      configured: !!forwardingEmail,
      forwardingEmail,
      message: forwardingEmail
        ? "Email forwarding active. Brokers can forward portal emails to this address."
        : "Set FORWARDING_EMAIL in .env to enable email forwarding.",
    };
  });
}

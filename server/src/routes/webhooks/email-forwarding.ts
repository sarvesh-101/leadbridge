/**
 * Email Forwarding Webhook — receives forwarded portal emails.
 *
 * POST /api/v1/webhooks/email/incoming
 *
 * Works with email forwarding services like:
 *   - SendGrid Inbound Parse
 *   - Mailgun Routes
 *   - CloudMailin
 *
 * Accepts JSON (modern email services) and form-encoded (SendGrid legacy)
 * payloads, extracts sender/subject/body, then delegates to the shared email
 * ingestion pipeline (broker lookup → parse → dedup → AI call).
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { processForwardedEmail } from "../../services/email-ingestion.service";
import { logger } from "../../utils/logger";

/** Generic email forwarding payload (normalized from multiple providers) */
interface EmailForwardPayload {
  from?: string;
  to?: string;
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

/** Extract the actual email address from a "Name <email>" format string. */
function extractEmail(input: string): string | null {
  if (!input) return null;
  const match = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

/** Extract the email body text from various email service formats. */
function extractBody(payload: EmailForwardPayload): string {
  return payload.text ||
         payload["body-plain"] ||
         payload["stripped-text"] ||
         payload.html?.replace(/<[^>]+>/g, "").trim() ||
         "";
}

export default async function emailForwardingRoutes(fastify: FastifyInstance) {
  fastify.post("/webhooks/email/incoming", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: EmailForwardPayload }>, reply: FastifyReply) => {
    const payload = request.body;
    const requestId = (request as unknown as Record<string, unknown>).requestId || "email-no-id";

    const senderEmail = extractEmail(payload.from || payload.From || payload.sender || "");
    const emailSubject = payload.subject || payload.Subject || "";
    const emailBody = extractBody(payload);

    logger.info({ from: senderEmail, subject: emailSubject?.substring(0, 80), bodyLen: emailBody.length },
      `[EMAIL] Incoming forwarded email ${requestId}`);

    const result = await processForwardedEmail(fastify, {
      from: senderEmail || "",
      subject: emailSubject,
      text: emailBody,
      meta: { webhookProvider: "email-forwarding" },
    });

    return reply.status(200).send({
      status: result.status,
      ...(result.status === "ignored" ? { reason: result.reason } : {}),
      ...(result.status === "created" ? { leadId: result.leadId } : {}),
    });
  });

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
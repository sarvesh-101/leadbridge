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
import { isWebhookRequestAuthorized } from "../../utils/webhook-secret";

/** Generic email forwarding payload (normalized from multiple providers) */
interface EmailForwardPayload {
  from?: string;
  to?: string | string[];
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
  // SendGrid posts an object, Mailgun/CloudMailin a JSON string.
  envelope?: unknown;
  // Raw header block (CloudMailin) and recipient-side headers.
  headers?: string;
  "delivered-to"?: string;
  "x-forwarded-to"?: string;
  "x-original-to"?: string;
  recipient?: string;
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

    // Authenticate before parsing or touching the database: this URL is public,
    // and a forged POST creates leads (each one a billable AI call).
    // No configured secret keeps the old open behaviour, so the route is safe to
    // deploy before the provider is wired.
    const authorized = isWebhookRequestAuthorized({
      headers: request.headers as Record<string, string | string[] | undefined>,
      query: request.query as Record<string, unknown> | undefined,
      expected: process.env.EMAIL_WEBHOOK_SECRET,
    });
    if (!authorized) {
      logger.warn({ requestId }, "[EMAIL] Rejected forwarded email: invalid or missing webhook secret");
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const senderEmail = extractEmail(payload.from || payload.From || payload.sender || "");
    const emailSubject = payload.subject || payload.Subject || "";
    const emailBody = extractBody(payload);

    logger.info({ from: senderEmail, subject: emailSubject?.substring(0, 80), bodyLen: emailBody.length },
      `[EMAIL] Incoming forwarded email ${requestId}`);

    // Per-broker address (`leads+<token>@<domain>`) wins over the sender, so
    // auto-forwarded portal mail still resolves to the right broker.
    const recipients = [
      payload.to,
      payload.To,
      payload.to_parsed,
      payload["delivered-to"],
      payload["x-forwarded-to"],
      payload["x-original-to"],
      payload.recipient,
      payload.envelope,
      payload.headers,
    ];

    const result = await processForwardedEmail(fastify, {
      from: senderEmail || "",
      subject: emailSubject,
      text: emailBody,
      recipients,
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
    // The mailbox that is actually readable: the IMAP poller's inbox when it is
    // wired, otherwise the shared mailbox (webhook-only setups).
    const forwardingEmail = process.env.IMAP_USER || process.env.FORWARDING_EMAIL || "";
    return {
      configured: !!forwardingEmail,
      // False = anyone who learns the URL can inject leads. Fine for local testing,
      // not for a live provider URL.
      secured: !!process.env.EMAIL_WEBHOOK_SECRET,
      forwardingEmail,
      message: forwardingEmail
        ? "Email forwarding active. Brokers can forward portal emails to this address."
        : "Set FORWARDING_EMAIL in .env to enable email forwarding.",
    };
  });
}
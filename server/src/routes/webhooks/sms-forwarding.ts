/**
 * SMS Forwarding Webhook (Twilio) — receives forwarded SMS from Twilio.
 *
 * POST /api/v1/webhooks/sms/incoming
 *
 * How it works:
 *   1. Broker forwards a portal SMS (99acres, MagicBricks, JustDial…) to Converza's Twilio number
 *   2. Twilio POSTs the message here with `From` (broker's number) and `Body` (SMS text)
 *   3. The shared SMS pipeline looks up the broker, parses the lead, and starts the AI call
 *
 * Twilio sends application/x-www-form-urlencoded: From, To, Body, MessageSid.
 * Signatures are verified when TWILIO_AUTH_TOKEN is set; without it the
 * endpoint fails CLOSED so nobody can forge leads.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { processForwardedSms } from "../../services/sms-forwarding.service";
import { config } from "../../config";
import { logger } from "../../utils/logger";

interface TwilioSmsPayload {
  From?: string;
  To?: string;
  Body?: string;
  MessageSid?: string;
}

/**
 * Validate Twilio webhook signature to ensure the request is genuinely from Twilio.
 * Uses the Twilio Auth Token from config.
 */
function validateTwilioRequest(url: string, params: Record<string, string>, signature: string | undefined): boolean {
  if (!signature) return false;
  const authToken = config.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const sortedKeys = Object.keys(params).sort();
  let sigString = url;
  for (const key of sortedKeys) {
    sigString += key + params[key];
  }
  const computed = crypto.createHmac("sha1", authToken).update(sigString).digest("base64");
  if (computed.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export default async function smsForwardingRoutes(fastify: FastifyInstance) {
  fastify.post("/webhooks/sms/incoming", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: TwilioSmsPayload }>, reply: FastifyReply) => {
    const { From, Body, To, MessageSid } = request.body;
    const xTwilioSignature = request.headers["x-twilio-signature"] as string | undefined;
    const requestId = (request as unknown as Record<string, unknown>).requestId || "sms-no-id";

    // Validate Twilio signature (only if TWILIO_AUTH_TOKEN is configured)
    if (config.TWILIO_AUTH_TOKEN) {
      const fullUrl = `${request.protocol}://${request.hostname}${request.url}`;
      const params = request.body as Record<string, string>;
      if (!validateTwilioRequest(fullUrl, params, xTwilioSignature)) {
        logger.warn({ requestId }, "[SMS] Invalid Twilio signature — rejecting");
        return reply.status(403).send({ error: "Invalid signature" });
      }
    } else {
      // SECURITY: No Twilio auth token configured — reject all SMS webhooks
      // to prevent anyone from POSTing fake leads. Set TWILIO_AUTH_TOKEN in
      // your environment to enable SMS forwarding.
      logger.warn({ requestId }, "[SMS] TWILIO_AUTH_TOKEN not configured — rejecting webhook (unauthenticated)");
      return reply.status(403).send({ error: "SMS webhook not configured" });
    }

    logger.info({ from: From, to: To, msgId: MessageSid, bodyLen: Body?.length, requestId }, `[SMS] Incoming forwarded SMS ${requestId}`);

    await processForwardedSms(fastify, {
      from: From || "",
      body: Body || "",
      to: To,
      messageId: MessageSid,
      provider: "Twilio",
    });

    // Twilio expects a 200 OK — empty TwiML response is fine
    return reply.status(200).type("text/xml").send("<Response></Response>");
  });

  // ─── Health check for SMS forwarding ─────────────────────────
  fastify.get("/webhooks/sms/status", async () => {
    const forwardingNumber = process.env.FORWARDING_SMS_NUMBER || "";
    return {
      configured: !!forwardingNumber,
      forwardingNumber,
      providers: {
        twilio: !!config.TWILIO_AUTH_TOKEN,
        messagebird: !!config.MESSAGEBIRD_API_KEY,
      },
      message: forwardingNumber
        ? "SMS forwarding active. Brokers can forward portal SMS to this number."
        : "Set FORWARDING_SMS_NUMBER in .env to enable SMS forwarding.",
    };
  });
}
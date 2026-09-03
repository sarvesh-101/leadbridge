/**
 * SMS Forwarding Webhook (MessageBird) — receives forwarded SMS via MessageBird.
 *
 * POST /api/v1/webhooks/sms/incoming-messagebird
 *
 * MessageBird delivers inbound SMS as form-encoded requests. Configure the
 * callback in the MessageBird dashboard (Developers → SMS → callback URL, or a
 * Flow Builder "Call HTTP endpoint" flow on an SMS-enabled number).
 *
 * Request fields (form-encoded): `id`, `sender`/`originator`, `recipient`,
 * `body`/`payload` (+ mccmnc, price, type, …). We accept the common aliases.
 *
 * Signature: MessageBird signs webhook requests with the X-MessageBird-Signature
 * header — base64(HMAC-SHA256(requestBody, signingKey)). Per MessageBird docs
 * the signing key is the token (their webhook token); we accept EITHER the
 * request's `token` query param or MESSAGEBIRD_API_KEY as the key, so the
 * dashboard configuration doesn't need to match exactly. Without a valid
 * signature the endpoint fails CLOSED.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { processForwardedSms } from "../../services/sms-forwarding.service";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { validMessageBirdSignature } from "../../utils/messagebird-signature";

interface MessageBirdSmsPayload {
  id?: string;
  sender?: string;
  originator?: string;
  recipient?: string;
  body?: string;
  payload?: string;
}

export default async function messageBirdSmsRoutes(fastify: FastifyInstance) {
  fastify.post("/webhooks/sms/incoming-messagebird", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: MessageBirdSmsPayload }>, reply: FastifyReply) => {
    const requestId = (request as unknown as Record<string, unknown>).requestId || "sms-mb-no-id";
    const signature = request.headers["x-messagebird-signature"] as string | undefined;
    const queryToken = (request.query as Record<string, string> | undefined)?.token;

    // SECURITY: without MESSAGEBIRD_API_KEY there's nothing to verify against — fail closed.
    if (!config.MESSAGEBIRD_API_KEY) {
      logger.warn({ requestId }, "[SMS-MB] MESSAGEBIRD_API_KEY not configured — rejecting webhook (unauthenticated)");
      return reply.status(403).send({ error: "SMS webhook not configured" });
    }

    if (!validMessageBirdSignature((request.raw as { body?: string }).body || "", queryToken, signature, config.MESSAGEBIRD_API_KEY)) {
      logger.warn({ requestId }, "[SMS-MB] Invalid MessageBird signature — rejecting");
      return reply.status(403).send({ error: "Invalid signature" });
    }

    const { id, sender, originator, recipient, body, payload } = request.body;
    const from = sender || originator || "";
    const text = body || payload || "";

    logger.info({ from, recipient, msgId: id, bodyLen: text.length, requestId }, "[SMS-MB] Incoming forwarded SMS");

    await processForwardedSms(fastify, {
      from,
      body: text,
      to: recipient,
      messageId: id,
      provider: "MessageBird",
    });

    // MessageBird accepts any response; never return an error status for handled events.
    return reply.status(200).send({ status: "ok" });
  });
}
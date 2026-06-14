import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyWebhook } from "../../services/whatsapp.service";
import { handleIncomingMessage } from "../../services/whatsapp-chatbot.service";
import { logger } from "../../utils/logger";

/**
 * WhatsApp Cloud API Webhook.
 *
 * Two functions:
 * 1. GET /webhooks/whatsapp — Webhook verification (Meta requires this)
 * 2. POST /webhooks/whatsapp — Incoming messages from leads
 */
export default async function whatsappWebhookRoutes(fastify: FastifyInstance) {
  // ─── Webhook Verification (Meta's required challenge) ────────
  fastify.get("/webhooks/whatsapp", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    const result = verifyWebhook(mode, token, challenge);
    if (result) {
      return reply.status(200).send(result);
    }

    return reply.status(403).send({ error: "Webhook verification failed" });
  });

  // ─── Incoming Messages ───────────────────────────────────────
  fastify.post("/webhooks/whatsapp", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, any>;

    // Meta sends a status update for verification — acknowledge quickly
    if (
      body.entry?.[0]?.changes?.[0]?.value?.statuses
    ) {
      // Status update (delivery receipt, read receipt) — just acknowledge
      return reply.status(200).send({ status: "ok" });
    }

    try {
      // Extract the incoming message
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        return reply.status(200).send({ status: "ok" });
      }

      for (const msg of messages) {
        if (msg.type === "text" && msg.from && msg.text?.body) {
          const fromNumber = msg.from;
          const messageBody = msg.text.body;
          const waMessageId = msg.id;

          // Process asynchronously — don't block the webhook response
          setImmediate(() => {
            handleIncomingMessage(fromNumber, messageBody, waMessageId).catch((err) => {
              logger.error({ err: err.message, fromNumber }, "Chatbot handler error");
            });
          });
        }
      }

      // Always respond 200 OK quickly to avoid Meta timeouts
      return reply.status(200).send({ status: "ok" });
    } catch (error: any) {
      logger.error({ err: error.message }, "WhatsApp webhook processing error");
      return reply.status(200).send({ status: "ok" }); // Always 200 to Meta
    }
  });
}

/**
 * IndiaMART Push API webhook receiver.
 *
 * POST /api/v1/webhooks/indiamart/:clientId
 *
 * IndiaMART's Lead Manager Push API POSTs every new lead to this URL in
 * real-time (the seller configures it in Lead Manager → Import/Export Leads →
 * Push API → "Other" CRM → enter this webhook URL → verify with OTP).
 *
 * Contract (from IndiaMART docs):
 *   - Must respond HTTP 200 to acknowledge receipt; anything else is retried
 *     (and after 48h of failures IndiaMART deactivates the push).
 *   - Dedup via UNIQUE_QUERY_ID (also enforced in the shared pipeline).
 *   - The `:clientId` path segment is the identifier IndiaMART appends per
 *     their "Webhook Listener URL Formation" guideline (https://domain/indiamart/{id}).
 *
 * SECURITY NOTE: IndiaMART's Push API sends no signature header, so this
 * endpoint is unauthenticated (same trust model as the generic ingest webhook).
 * It is rate-limited, gated by the account's daily/monthly lead caps, and the
 * path identifier is a random client UUID.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { extractIndiaMartResponse, normalizeIndiaMartLead, createLeadFromIndiaMart } from "../../services/indiamart.service";
import { logger } from "../../utils/logger";

export default async function indiaMartWebhookRoutes(fastify: FastifyInstance) {
  fastify.post("/webhooks/indiamart/:clientId", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Params: { clientId: string } }>, reply: FastifyReply) => {
    const { clientId } = request.params;
    const body = request.body as Record<string, unknown>;

    const response = extractIndiaMartResponse(body);
    if (!response) {
      logger.warn({ clientId }, "IndiaMART webhook: no RESPONSE payload found — rejecting (will be retried by IndiaMART)");
      return reply.status(400).send({ error: "Missing IndiaMART RESPONSE payload" });
    }

    const lead = normalizeIndiaMartLead(response);
    if (!lead) {
      // Unparseable (no phone / no query id) — 400 so IndiaMART retries a few
      // times, then logs it. A 200 would drop the lead silently.
      logger.warn({ clientId }, "IndiaMART webhook: lead rejected by normalizer");
      return reply.status(400).send({ error: "Unusable lead payload" });
    }

    const result = await createLeadFromIndiaMart(
      { prisma: fastify.prisma, redis: fastify.redis, log: (msg) => fastify.log.info(msg) },
      { clientId, lead }
    );

    if (result.status === "skipped") {
      // Account inactive / over limits — acknowledge so IndiaMART doesn't
      // retry forever, but surface it in the integration status.
      return reply.status(200).send({ status: "skipped", reason: "account_or_limit" });
    }

    return reply.status(200).send({
      status: "ok",
      outcome: result.status,
      leadId: result.leadId,
    });
  });
}
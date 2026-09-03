/**
 * Facebook Lead Ads webhook (Meta `leadgen`).
 *
 * GET  /api/v1/webhooks/facebook — Meta's subscription verification
 *      (?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...)
 * POST /api/v1/webhooks/facebook — leadgen events (real-time lead pushes)
 *
 * The page_id in each event is mapped to the broker's saved Facebook
 * integration; the page token is used to fetch the full lead data via the
 * Graph API, then the lead enters the shared pipeline → AI call.
 *
 * Failure semantics: return HTTP 200 to acknowledge. Non-200 (e.g. a
 * transient Graph fetch error) makes Meta retry the delivery.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { decrypt } from "../../utils/encryption";
import {
  parseLeadgenWebhook,
  fetchFacebookLead,
  createLeadFromFacebook,
} from "../../services/facebook-leads.service";

export default async function facebookWebhookRoutes(fastify: FastifyInstance) {
  // ─── Verification (Meta requires this on subscription) ────────
  fastify.get("/webhooks/facebook", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token && config.FACEBOOK_VERIFY_TOKEN && token === config.FACEBOOK_VERIFY_TOKEN) {
      return reply.type("text/plain").send(challenge);
    }
    return reply.status(403).send({ error: "Verification failed" });
  });

  // ─── Leadgen events ───────────────────────────────────────────
  fastify.post("/webhooks/facebook", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const events = parseLeadgenWebhook(body);

    if (events.length === 0) {
      return reply.status(200).send({ status: "ignored", reason: "no_leadgen_events" });
    }

    for (const event of events) {
      // Map page_id → broker integration
      const integration = await fastify.prisma.integration.findFirst({
        where: { provider: "facebook", settings: { path: ["pageId"], equals: event.pageId } },
      });

      if (!integration || !integration.apiKey) {
        logger.warn({ pageId: event.pageId, leadgenId: event.leadgenId }, "Facebook webhook: no broker mapped to this page — ignored");
        continue;
      }

      const pageToken = decrypt(integration.apiKey);

      try {
        const lead = await fetchFacebookLead(event.leadgenId, pageToken);
        if (!lead) {
          continue; // no usable phone — nothing to call
        }

        const result = await createLeadFromFacebook(
          { prisma: fastify.prisma, redis: fastify.redis },
          { clientId: integration.clientId, lead }
        );

        await fastify.prisma.integration.update({
          where: { id: integration.id },
          data: {
            lastSyncAt: new Date(),
            ...(result.status === "created" ? { totalSynced: { increment: 1 } } : {}),
            status: "ACTIVE",
            lastErrorMessage: null,
          },
        }).catch(() => {});
      } catch (err: any) {
        logger.warn({ leadgenId: event.leadgenId, err: err.message }, "Facebook webhook: lead fetch failed — returning 500 for Meta retry");
        await fastify.prisma.integration
          .update({
            where: { id: integration.id },
            data: {
              status: "ERROR",
              totalErrors: { increment: 1 },
              lastErrorMessage: (err.message || "Webhook processing failed").slice(0, 300),
              lastErrorAt: new Date(),
            },
          })
          .catch(() => {});
        return reply.status(500).send({ error: "Retry" });
      }
    }

    return reply.status(200).send({ status: "ok" });
  });
}
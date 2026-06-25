/**
 * Webhook Sources Route — lists webhook sources with ingest URLs.
 *
 * Ported from FastAPI: GET /integrations/sources
 */
import { FastifyInstance, FastifyRequest } from "fastify";

export default async function webhookSourcesRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Webhook Sources with Ingest URLs ──────────────────────
  // Ported from FastAPI: GET /integrations/sources
  fastify.get("/integrations/sources", async (request: FastifyRequest) => {
    const webhooks = await fastify.prisma.webhookSource.findMany({
      where: { clientId: request.clientId },
    });

    const baseUrl = `${request.protocol}://${request.hostname}`;

    return {
      sources: webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        active: w.active,
        ingestUrl: `${baseUrl}/api/v1/webhooks/ingest/${w.token}`,
        createdAt: w.createdAt,
      })),
    };
  });
}

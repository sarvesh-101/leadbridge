/**
 * Call Transcript Search Routes.
 *
 * Enables brokers and admins to search across all call transcripts
 * for keywords like "budget", "Andheri", "ready to move", etc.
 */
import { FastifyInstance, FastifyRequest } from "fastify";

export default async function transcriptSearchRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Search Call Transcripts ─────────────────────────────────
  fastify.get("/calls/search", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { q, page = "1", limit = "20", dateFrom, dateTo, minDuration } =
      request.query as Record<string, string>;

    if (!q || q.trim().length < 2) {
      return { results: [], total: 0 };
    }

    const { searchTranscripts } = await import("../../services/transcript-search.service");
    const result = await searchTranscripts(clientId, q.trim(), {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      dateFrom,
      dateTo,
      minDuration: minDuration ? parseInt(minDuration) : undefined,
    });

    return {
      ...result,
      query: q.trim(),
      page: parseInt(page),
      limit: parseInt(limit),
    };
  });

  // ─── Search Stats ────────────────────────────────────────────
  fastify.get("/calls/search/stats", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { getTranscriptSearchStats } = await import("../../services/transcript-search.service");
    return await getTranscriptSearchStats(clientId);
  });

  // ─── Admin: Search All Transcripts ──────────────────────────
  fastify.get("/admin/calls/search", {
    preHandler: [fastify.authenticateAdmin],
  }, async (request: FastifyRequest) => {
    const { q, page = "1", limit = "20", clientId } =
      request.query as Record<string, string>;

    if (!q || q.trim().length < 2) {
      return { results: [], total: 0 };
    }

    const { searchAllTranscripts } = await import("../../services/transcript-search.service");
    const result = await searchAllTranscripts(q.trim(), {
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      clientId: clientId || undefined,
    });

    return {
      ...result,
      query: q.trim(),
      page: parseInt(page),
      limit: parseInt(limit),
    };
  });
}

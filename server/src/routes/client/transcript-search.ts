/**
 * Call Transcript Search Routes.
 *
 * Enables brokers and admins to search across all call transcripts
 * for keywords like "budget", "Andheri", "ready to move", etc.
 */
import { FastifyInstance, FastifyRequest } from "fastify";

/** Parse + clamp pagination from raw query strings (avoids NaN/negative abuse). */
function parsePagination(pageRaw: string, limitRaw: string): { page: number; limit: number; offset: number } {
  const parsedPage = parseInt(pageRaw, 10);
  const parsedLimit = parseInt(limitRaw, 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

/** Parse minDuration — returns undefined for missing/invalid values. */
function parseMinDuration(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

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

    const { page: safePage, limit: safeLimit, offset } = parsePagination(page, limit);

    const { searchTranscripts } = await import("../../services/transcript-search.service");
    const result = await searchTranscripts(clientId, q.trim(), {
      limit: safeLimit,
      offset,
      dateFrom,
      dateTo,
      minDuration: parseMinDuration(minDuration),
    });

    return {
      ...result,
      query: q.trim(),
      page: safePage,
      limit: safeLimit,
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

    const { page: safePage, limit: safeLimit, offset } = parsePagination(page, limit);

    const { searchAllTranscripts } = await import("../../services/transcript-search.service");
    const result = await searchAllTranscripts(q.trim(), {
      limit: safeLimit,
      offset,
      clientId: clientId || undefined,
    });

    return {
      ...result,
      query: q.trim(),
      page: safePage,
      limit: safeLimit,
    };
  });
}

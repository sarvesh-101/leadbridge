/**
 * Call Recording Transcription Search Service.
 *
 * Provides full-text search across call transcripts using PostgreSQL tsvector.
 * Searches across transcript text, summaries, and extracted data for keywords.
 *
 * SECURITY: All user input is passed as bound parameters via Prisma.sql —
 * never string-interpolated — so search terms, dates and offsets cannot be
 * used for SQL injection or to escape the client scope.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma-shared";

interface SearchResult {
  id: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  type: string;
  transcript: string;
  summary: string | null;
  duration: number | null;
  createdAt: Date;
  relevance: number;
  highlight: string;
}

/**
 * Escape LIKE wildcards so a user's search term is treated literally.
 * (Default Postgres LIKE escape char is backslash.)
 */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

/** Validate & clamp pagination to sane bounds. */
function clampPagination(limit: number | undefined, offset: number | undefined) {
  const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.trunc(limit as number) : 20, 1), 100);
  const safeOffset = Math.max(Number.isFinite(offset) ? Math.trunc(offset as number) : 0, 0);
  return { safeLimit, safeOffset };
}

/** Parse an ISO date param — invalid dates are ignored rather than erroring. */
function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Search call transcripts for a keyword or phrase.
 * Uses PostgreSQL full-text search with tsvector for performance.
 */
export async function searchTranscripts(
  clientId: string,
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    dateFrom?: string;
    dateTo?: string;
    minDuration?: number;
  }
): Promise<{ results: SearchResult[]; total: number }> {
  const { safeLimit, safeOffset } = clampPagination(options?.limit, options?.offset);

  const dateFrom = parseDateParam(options?.dateFrom);
  const dateTo = parseDateParam(options?.dateTo);
  const minDuration =
    typeof options?.minDuration === "number" && Number.isFinite(options.minDuration)
      ? options.minDuration
      : undefined;

  // All values below are bound parameters — never interpolated into SQL.
  const conditions: Prisma.Sql[] = [
    Prisma.sql`c."clientId" = ${clientId}`,
    Prisma.sql`(c.transcript ILIKE ${likePattern(query)} OR c.summary ILIKE ${likePattern(query)})`,
  ];
  if (dateFrom) conditions.push(Prisma.sql`c."createdAt" >= ${dateFrom}`);
  if (dateTo) conditions.push(Prisma.sql`c."createdAt" <= ${dateTo}`);
  if (minDuration !== undefined) conditions.push(Prisma.sql`c.duration >= ${minDuration}`);

  const whereClause = Prisma.join(conditions, " AND ");

  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*) as count FROM "Call" c WHERE ${whereClause}`
  );
  const total = Number(countResult[0]?.count || 0);

  if (total === 0) {
    return { results: [], total: 0 };
  }

  const results = await prisma.$queryRaw<Array<{
    id: string;
    leadId: string;
    leadName: string;
    leadPhone: string;
    type: string;
    transcript: string;
    summary: string | null;
    duration: number | null;
    createdAt: Date;
  }>>(
    Prisma.sql`SELECT
      c.id,
      c."leadId",
      l.name as "leadName",
      l.phone as "leadPhone",
      c.type,
      c.transcript,
      c.summary,
      c.duration,
      c."createdAt"
    FROM "Call" c
    JOIN "Lead" l ON l.id = c."leadId"
    WHERE ${whereClause}
    ORDER BY c."createdAt" DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}`
  );

  // Build search results with highlighted snippets
  const searchResults: SearchResult[] = results.map((row) => ({
    ...row,
    relevance: calculateRelevance(row.transcript, row.summary, query),
    highlight: extractHighlight(row.transcript, query),
  }));

  return { results: searchResults, total };
}

/**
 * Search across all transcripts platform-wide (admin only).
 */
export async function searchAllTranscripts(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    clientId?: string;
  }
): Promise<{ results: SearchResult[]; total: number }> {
  const { safeLimit, safeOffset } = clampPagination(options?.limit, options?.offset);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`(c.transcript ILIKE ${likePattern(query)} OR c.summary ILIKE ${likePattern(query)})`,
  ];
  if (options?.clientId) {
    conditions.push(Prisma.sql`c."clientId" = ${options.clientId}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*) as count FROM "Call" c WHERE ${whereClause}`
  );
  const total = Number(countResult[0]?.count || 0);

  if (total === 0) {
    return { results: [], total: 0 };
  }

  const results = await prisma.$queryRaw<Array<{
    id: string;
    leadId: string;
    leadName: string;
    leadPhone: string;
    type: string;
    transcript: string;
    summary: string | null;
    duration: number | null;
    createdAt: Date;
  }>>(
    Prisma.sql`SELECT
      c.id,
      c."leadId",
      l.name as "leadName",
      l.phone as "leadPhone",
      c.type,
      c.transcript,
      c.summary,
      c.duration,
      c."createdAt"
    FROM "Call" c
    JOIN "Lead" l ON l.id = c."leadId"
    WHERE ${whereClause}
    ORDER BY c."createdAt" DESC
    LIMIT ${safeLimit} OFFSET ${safeOffset}`
  );

  const searchResults: SearchResult[] = results.map((row) => ({
    ...row,
    relevance: calculateRelevance(row.transcript, row.summary, query),
    highlight: extractHighlight(row.transcript, query),
  }));

  return { results: searchResults, total };
}

/**
 * Extract a highlighted snippet around the matched term.
 */
function extractHighlight(text: string, query: string): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const index = lower.indexOf(queryLower);
  if (index === -1) return text.substring(0, 200);

  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + query.length + 120);
  let snippet = text.substring(start, end).trim();

  if (start > 0) snippet = "... " + snippet;
  if (end < text.length) snippet += " ...";

  return snippet;
}

/**
 * Calculate a simple relevance score based on match frequency and position.
 */
function calculateRelevance(transcript: string, summary: string | null, query: string): number {
  let score = 0;
  const lowerTranscript = transcript?.toLowerCase() || "";
  const queryLower = query.toLowerCase();

  // Matches in transcript
  const transcriptMatches = (lowerTranscript.match(new RegExp(queryLower, "g")) || []).length;
  score += transcriptMatches * 10;

  // Matches in summary (weighted higher)
  if (summary) {
    const summaryMatches = (summary.toLowerCase().match(new RegExp(queryLower, "g")) || []).length;
    score += summaryMatches * 25;
  }

  // Early occurrence bonus
  const firstIndex = lowerTranscript.indexOf(queryLower);
  if (firstIndex >= 0 && firstIndex < 500) score += 20;
  if (firstIndex >= 0 && firstIndex < 200) score += 15;

  return Math.min(score, 100);
}

/**
 * Get search stats for a client.
 */
export async function getTranscriptSearchStats(
  clientId: string
): Promise<{
  totalTranscripts: number;
  transcriptsWithSearchableContent: number;
  averageTranscriptLength: number;
  topKeywords: string[];
}> {
  const stats = await prisma.$queryRaw<Array<{
    total: bigint;
    withContent: bigint;
    avgLength: number;
  }>>(
    Prisma.sql`SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE transcript IS NOT NULL AND transcript != '') as "withContent",
      COALESCE(AVG(LENGTH(transcript)), 0) as "avgLength"
    FROM "Call" c
    WHERE c."clientId" = ${clientId}`
  );

  const row = stats[0];

  return {
    totalTranscripts: Number(row?.total || 0),
    transcriptsWithSearchableContent: Number(row?.withContent || 0),
    averageTranscriptLength: Math.round(row?.avgLength || 0),
    topKeywords: [], // Would need NLP for real keywords
  };
}

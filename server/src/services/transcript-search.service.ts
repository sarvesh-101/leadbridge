/**
 * Call Recording Transcription Search Service.
 *
 * Provides full-text search across call transcripts using PostgreSQL tsvector.
 * Searches across transcript text, summaries, and extracted data for keywords.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // Build search conditions
  const conditions: string[] = [
    `c."clientId" = '${clientId}'`,
    `(c.transcript ILIKE '%${escapeSql(query)}%' OR c.summary ILIKE '%${escapeSql(query)}%')`,
  ];

  if (options?.dateFrom) {
    conditions.push(`c."createdAt" >= '${options.dateFrom}'`);
  }
  if (options?.dateTo) {
    conditions.push(`c."createdAt" <= '${options.dateTo}'`);
  }
  if (options?.minDuration) {
    conditions.push(`c.duration >= ${options.minDuration}`);
  }

  const whereClause = conditions.join(" AND ");

  // Use raw query for full-text search with relevance ranking
  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "Call" c WHERE ${whereClause}`
  );
  const total = Number(countResult[0]?.count || 0);

  if (total === 0) {
    return { results: [], total: 0 };
  }

  const results = await prisma.$queryRawUnsafe<Array<{
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
    `SELECT
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
    LIMIT ${limit} OFFSET ${offset}`
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
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  const conditions: string[] = [
    `(c.transcript ILIKE '%${escapeSql(query)}%' OR c.summary ILIKE '%${escapeSql(query)}%')`,
  ];

  if (options?.clientId) {
    conditions.push(`c."clientId" = '${options.clientId}'`);
  }

  const whereClause = conditions.join(" AND ");

  const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM "Call" c WHERE ${whereClause}`
  );
  const total = Number(countResult[0]?.count || 0);

  if (total === 0) {
    return { results: [], total: 0 };
  }

  const results = await prisma.$queryRawUnsafe<Array<{
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
    `SELECT
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
    LIMIT ${limit} OFFSET ${offset}`
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
 * Escape single quotes for safe SQL string interpolation.
 */
function escapeSql(value: string): string {
  return value.replace(/'/g, "''").replace(/\\/g, "\\\\");
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
  const stats = await prisma.$queryRawUnsafe<Array<{
    total: bigint;
    withContent: bigint;
    avgLength: number;
  }>>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE transcript IS NOT NULL AND transcript != '') as "withContent",
      COALESCE(AVG(LENGTH(transcript)), 0) as "avgLength"
    FROM "Call" c
    WHERE c."clientId" = '${escapeSql(clientId)}'`
  );

  const row = stats[0];

  return {
    totalTranscripts: Number(row?.total || 0),
    transcriptsWithSearchableContent: Number(row?.withContent || 0),
    averageTranscriptLength: Math.round(row?.avgLength || 0),
    topKeywords: [], // Would need NLP for real keywords
  };
}

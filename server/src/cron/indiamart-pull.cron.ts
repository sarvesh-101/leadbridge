/**
 * IndiaMART Pull API poller — every 5 minutes.
 *
 * Primary ingestion is the Push API webhook (real-time). This cron is the
 * fallback / backfill path for brokers whose Push API isn't enabled (or
 * covers the gap if a push was missed). It pulls leads for every broker that
 * has saved IndiaMART credentials.
 *
 * Window handling:
 *   - Each client stores `lastPullTime` inside their Integration settings.
 *   - We pull from `lastPullTime - 5 min` (overlap) to `now` so no lead is
 *     lost between ticks, and advance `lastPullTime` only on success.
 *   - Dedup is enforced by UNIQUE_QUERY_ID tracking in settings (capped list)
 *     plus the 30-day phone check in the shared pipeline.
 *
 * Runs under the distributed cron lock so a second server instance doesn't
 * double-pull.
 */
import type { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { fetchIndiaMartLeads, createLeadFromIndiaMart } from "../services/indiamart.service";
import { decrypt } from "../utils/encryption";

const PULL_OVERLAP_MS = 5 * 60 * 1000; // re-pull last 5 min to avoid gaps
const MAX_QUERY_IDS_TRACKED = 500; // cap on the in-settings dedup list

/**
 * Sync ONE IndiaMART integration: pull new leads since the last pull and
 * advance progress. Used by the 5-min cron and the manual "Sync now" route.
 * Returns { processed, created, skipped }.
 */
export async function syncIndiaMartClient(
  prisma: PrismaClient,
  integration: {
    id: string;
    clientId: string;
    apiKey: string | null;
    settings: unknown;
  }
): Promise<{ processed: number; created: number; skipped: number }> {
  const settings = (integration.settings as Record<string, unknown>) || {};
  const mobile = typeof settings.mobile === "string" ? settings.mobile : "";

  if (!integration.apiKey || !mobile) {
    return { processed: 0, created: 0, skipped: 0 }; // not fully configured yet
  }

  const crmKey = decrypt(integration.apiKey);

  // lastPullTime lives in settings so no schema migration is needed.
  const lastPullMs = typeof settings.lastPullTime === "string" ? Date.parse(settings.lastPullTime) : NaN;
  const lastPull = Number.isNaN(lastPullMs) ? new Date(Date.now() - 60 * 60 * 1000) : new Date(lastPullMs - PULL_OVERLAP_MS);
  const end = new Date();

  // Sanity: never pull more than 24h in one tick (protects against a stale
  // lastPullTime after long downtime — backfill is capped at 24h).
  if (end.getTime() - lastPull.getTime() > 24 * 60 * 60 * 1000) {
    logger.warn({ clientId: integration.clientId }, "IndiaMART pull: window > 24h — clamping to 24h");
    lastPull.setTime(end.getTime() - 24 * 60 * 60 * 1000);
  }

  const leads = await fetchIndiaMartLeads(crmKey, mobile, lastPull, end);

  const seen = new Set(Array.isArray(settings.lastQueryIds) ? (settings.lastQueryIds as string[]) : []);
  let created = 0;
  let skipped = 0;

  for (const lead of leads) {
    if (seen.has(lead.uniqueQueryId)) {
      skipped++;
      continue;
    }
    const result = await createLeadFromIndiaMart({ prisma }, { clientId: integration.clientId, lead });
    if (result.status === "created") {
      created++;
      seen.add(lead.uniqueQueryId);
    } else {
      skipped++;
    }
  }

  // Persist progress: advance lastPullTime + trimmed query-id dedup list.
  const trimmed = Array.from(seen).slice(-MAX_QUERY_IDS_TRACKED);
  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      totalSynced: { increment: created },
      settings: { ...settings, lastPullTime: end.toISOString(), lastQueryIds: trimmed },
      status: "ACTIVE",
      lastErrorMessage: null,
    },
  });

  return { processed: leads.length, created, skipped };
}

export async function runIndiaMartPull(): Promise<{ processed: number; created: number; skipped: number; errors: number }> {
  const { prisma } = await import("../utils/prisma-shared");

  const integrations = await prisma.integration.findMany({
    where: { provider: "indiamart" },
    select: { id: true, clientId: true, apiKey: true, settings: true, status: true },
  });

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const integration of integrations) {
    try {
      const result = await syncIndiaMartClient(prisma, integration);
      processed += result.processed;
      created += result.created;
      skipped += result.skipped;
    } catch (err: any) {
      errors++;
      logger.warn({ clientId: integration.clientId, err: err.message }, "IndiaMART pull failed for client");
      await prisma.integration
        .update({
          where: { id: integration.id },
          data: {
            status: "ERROR",
            totalErrors: { increment: 1 },
            lastErrorMessage: (err.message || "Pull failed").slice(0, 300),
            lastErrorAt: new Date(),
          },
        })
        .catch(() => {});
    }
  }

  if (integrations.length > 0) {
    logger.info({ clients: integrations.length, processed, created, skipped, errors }, "IndiaMART pull cycle complete");
  }

  return { processed, created, skipped, errors };
}
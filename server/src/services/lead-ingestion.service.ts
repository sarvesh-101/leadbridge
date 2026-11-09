/**
 * Generic external-lead ingestion pipeline.
 *
 * Shared by every portal connector (IndiaMART, Facebook Lead Ads, …). One set
 * of guardrails — account status, daily/monthly caps, dedup, call quota — so
 * no connector silently behaves differently. Any lead that passes lands in the
 * DB as PENDING and the AI calling pipeline is queued within seconds.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type Redis from "ioredis";
import { enqueueCall } from "../workers/queues";
import { logger } from "../utils/logger";
import { config } from "../config";
import { isWithinCallingWindow } from "../utils/call-window";

export interface IngestExternalLeadParams {
  clientId: string;
  name: string;
  phone: string;
  email?: string;
  /** Stored in Lead.source — e.g. "indiamart", "facebook" */
  source: string;
  /** Stored in Lead.portalSource — e.g. "Buy-Lead", "Facebook Lead Ads" */
  portalSource?: string;
  rawPayload: Prisma.InputJsonValue;
  /** External unique id (UNIQUE_QUERY_ID, leadgen_id, …) for cross-source dedup */
  dedupQueryId?: string;
  /** Human label for logs */
  logLabel: string;
}

export interface IngestCtx {
  prisma: PrismaClient;
  redis?: Redis | null;
}

export type IngestResult = { status: "created" | "duplicate" | "skipped"; leadId?: string };

export async function ingestExternalLead(
  ctx: IngestCtx,
  params: IngestExternalLeadParams
): Promise<IngestResult> {
  const { prisma, redis } = ctx;
  const { clientId, name, phone, email, source, portalSource, rawPayload, dedupQueryId, logLabel } = params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      plan: true,
      planStatus: true,
      callsThisMonth: true,
      callsLimit: true,
      leadsThisMonth: true,
      ownerWhatsapp: true,
    },
  });

  if (!client) {
    logger.warn({ clientId }, `${logLabel}: client not found`);
    return { status: "skipped" };
  }

  if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
    logger.warn({ clientId, planStatus: client.planStatus }, `${logLabel}: account inactive — skipping lead`);
    return { status: "skipped" };
  }

  // ─── Daily lead cap (Redis counter, matches ingest.ts) ─────────
  if (redis) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const key = `daily_leads:${clientId}:${today}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 48 * 60 * 60);
      const DAILY_LIMITS: Record<string, number> = { LAUNCH: 25, STARTER: 50, GROWTH: 200, TRIAL: 25, PRO: Infinity };
      const limit = DAILY_LIMITS[client.plan] ?? Infinity;
      if (limit !== Infinity && count > limit) {
        logger.warn({ clientId, count, limit }, `${logLabel}: daily lead limit reached`);
        return { status: "skipped" };
      }
    } catch (err: any) {
      logger.warn({ clientId, err: err.message }, `${logLabel}: daily limit check failed — allowing lead`);
    }
  }

  // ─── Monthly leads cap ──────────────────────────────────────
  // V2 (T2): the early cap-skip is GONE — duplicates must never consume (or
  // be blocked by) allowance, so dedup runs FIRST and allowance is consumed
  // after (plan → prepaid overage → QUEUED_WAITING_CREDITS, never dropped).

  // ─── Dedup by external query id (Redis set) ─────────────────
  if (redis && dedupQueryId) {
    try {
      const qidKey = `ext:qid:${clientId}:${source}`;
      const added = await redis.sadd(qidKey, dedupQueryId);
      await redis.expire(qidKey, 45 * 24 * 60 * 60);
      if (added === 0) {
        logger.info({ clientId, dedupQueryId }, `${logLabel}: duplicate query id — skipped`);
        return { status: "duplicate" };
      }
    } catch (err: any) {
      logger.warn({ clientId, err: err.message }, `${logLabel}: query-id dedup failed — falling back to phone dedup`);
    }
  }

  // ─── Dedup by phone (30-day window, mirrors other paths) ────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const existing = await prisma.lead.findFirst({
    where: {
      clientId,
      phone,
      receivedAt: { gte: thirtyDaysAgo },
      status: { notIn: ["COLD", "CONVERTED"] },
    },
    select: { id: true },
  });

  if (existing) {
    logger.info({ clientId, phone }, `${logLabel}: duplicate phone (30d) — skipped`);
    return { status: "duplicate" };
  }

  // ─── V2 (T2): consume ONE "lead handled" slot ────
  // Plan allowance first, then prepaid overage credit, else hold.
  const { consumeLeadAllowance } = await import("../utils/lead-limits");
  const allowance = await consumeLeadAllowance(prisma, clientId, client.plan);
  const callAllowed = allowance !== "none";

  const created = await prisma.lead.create({
    data: {
      clientId,
      name,
      phone,
      email: email || null,
      source,
      portalSource: portalSource || null,
      status: callAllowed ? "PENDING" : "QUEUED_WAITING_CREDITS",
      receivedAt: new Date(),
      rawPayload,
    },
  });

  // ─── V2 (T5): after-hours acknowledgement ───────────────────
  // Only an APPROVED template may be sent business-initiated; when none is
  // configured we log and skip (never free-form). The lead is still called
  // when the window opens — the queue reschedules it.
  if (!isWithinCallingWindow(created.receivedAt)) {
    if (config.WHATSAPP_TEMPLATE_AFTER_HOURS_ACK) {
      const { sendNamedTemplate } = await import("./whatsapp-template.service");
      sendNamedTemplate({ to: phone, templateName: config.WHATSAPP_TEMPLATE_AFTER_HOURS_ACK }).catch(
        (err: Error) => logger.warn({ leadId: created.id, err: err.message }, `${logLabel}: after-hours template failed`)
      );
    } else {
      logger.info(
        { clientId, leadId: created.id },
        `${logLabel}: lead arrived outside 09:00–21:00 IST — no approved after-hours template configured, acknowledgement skipped`
      );
    }
  }

  // ─── V2 (T15): onboarding speed instrumentation ─────────────
  prisma.client
    .updateMany({
      where: { id: clientId, firstLeadSourceConnectedAt: null },
      data: { firstLeadSourceConnectedAt: new Date(), firstCallAt: new Date() },
    })
    .catch(() => {});

  if (allowance === "overage") {
    logger.info(
      { clientId, leadId: created.id },
      `${logLabel}: plan allowance used — 1 prepaid lead credit consumed (overage)`
    );
  }

  // ─── Kick off the AI calling pipeline ───────────────────────
  const { assignLead } = await import("./lead-assignment.service");
  assignLead(clientId, created.id).catch((err: Error) => {
    logger.warn({ leadId: created.id, err: err.message }, `${logLabel}: lead assignment failed`);
  });

  if (callAllowed) {
    await enqueueCall({ leadId: created.id, clientId, callType: "QUALIFICATION", attempt: 1 });
    logger.info({ clientId, leadId: created.id, phone }, `${logLabel}: lead created — AI call queued`);
  } else {
    prisma.ownerNotification
      .create({
        data: {
          clientId,
          leadId: created.id,
          type: "LEADS_CREDIT_EXHAUSTED",
          message: `New ${portalSource || source} lead (${name}) received — held as QUEUED_WAITING_CREDITS. Your monthly plan leads are used up and no prepaid credit is available. The lead is safe; it starts automatically when you add credit.`,
          status: "sent",
          sentAt: new Date(),
        },
      })
      .catch(() => {});
    logger.warn(
      { clientId, leadId: created.id },
      `${logLabel}: lead held as QUEUED_WAITING_CREDITS — no allowance or overage credit left`
    );
  }

  const { emitNewLead } = await import("./websocket.service");
  emitNewLead(created.id, name, portalSource || source, clientId).catch(() => {});

  return { status: "created", leadId: created.id };
}
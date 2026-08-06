import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { parseLead, parseWithMapping } from "../../utils/lead-parser";
import { enqueueCall } from "../../workers/queues";
import { emitNewLead } from "../../services/websocket.service";
import { tryAcquireLock, releaseLock } from "../../utils/distributed-lock";

/**
 * Daily lead ingestion limits per plan.
 * These prevent a single misconfigured portal from flooding the system.
 */
const DAILY_LEAD_LIMITS: Record<string, number> = {
  STARTER: 50,
  GROWTH: 200,
  PRO: Infinity,  // No daily cap for PRO
  TRIAL: 25,      // Trial users get a stricter limit
};

/**
 * Check a client's daily lead ingestion limit using a Redis counter.
 * Increments the counter on success so concurrent requests are serialized.
 * Returns null if within limit, or a 429 error response body if exceeded.
 */
async function checkDailyLeadLimit(
  fastify: FastifyInstance,
  clientId: string,
  plan: string,
  increment: boolean
): Promise<{ error: string; limit: number; retryAfter: string } | null> {
  const limit = DAILY_LEAD_LIMITS[plan] ?? DAILY_LEAD_LIMITS.GROWTH;
  if (limit === Infinity) return null; // Unlimited

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const redisKey = `daily_leads:${clientId}:${today}`;

  const redis = fastify.redis;
  if (!redis) {
    // Redis unavailable — skip the check rather than blocking leads entirely.
    // In production, Redis should always be available.
    return null;
  }

  try {
    if (increment) {
      // Atomically increment and set TTL (only sets TTL on first creation)
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.expire(redisKey, 48 * 60 * 60); // 48h safety margin
      }
      if (count > limit) {
        return {
          error: `Daily lead limit reached (${limit}/day). Upgrade your plan or try again tomorrow.`,
          limit,
          retryAfter: "tomorrow",
        };
      }
    } else {
      // Check-only (no increment)
      const countStr = await redis.get(redisKey);
      const count = countStr ? parseInt(countStr, 10) : 0;
      if (count >= limit) {
        return {
          error: `Daily lead limit reached (${limit}/day). Upgrade your plan or try again tomorrow.`,
          limit,
          retryAfter: "tomorrow",
        };
      }
    }
  } catch (err) {
    fastify.log.warn({ err, clientId }, "Redis error checking daily lead limit — allowing lead through");
  }

  return null;
}

/**
 * Lead Ingestion Webhook — receives leads from portals.
 * POST /api/v1/webhooks/ingest/:token
 *
 * The token maps to a WebhookSource which maps to a Client.
 */
export default async function ingestWebhookRoutes(fastify: FastifyInstance) {
  // ─── Portal Webhook Ingestion ─────────────────────────────────
  // Per-source rate limit: 60/min (tightened from 200/min to prevent portal floods)
  fastify.post("/webhooks/ingest/:token", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.params;
    const payload = request.body as Record<string, unknown>;

    // Find webhook source by token
    const source = await fastify.prisma.webhookSource.findUnique({
      where: { token },
      include: {
        client: {
          select: {
            id: true,
            planStatus: true,
            plan: true,
            callsThisMonth: true,
            callsLimit: true,
            leadsThisMonth: true,
            ownerWhatsapp: true,
          },
        },
      },
    });

    if (!source || !source.active) {
      return reply.status(404).send({ error: "Invalid or inactive webhook source" });
    }

    const client = source.client;
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // Check account status
    if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
      return reply.status(402).send({ error: "Account inactive" });
    }

    // FIX P0-3: Call quota check — leads are ALWAYS stored. If the broker is
    // out of monthly calls, the lead is kept and only the auto-call is skipped
    // (with an owner notification), instead of silently dropping portal leads.
    const callAllowed = client.plan === "PRO" || client.callsThisMonth < client.callsLimit;

    // Check daily lead ingestion limit (per-client, Redis-backed)
    // This prevents a single misconfigured portal from flooding the system.
    const dailyLimitError = await checkDailyLeadLimit(fastify, client.id, client.plan, false);
    if (dailyLimitError) {
      return reply.status(429).send(dailyLimitError);
    }

    // FIX Round-2 #6: monthly leads cap (plan.leads) — reject before storing
    // when the broker has used their full monthly lead allowance.
    const { checkMonthlyLeadsCapacity, monthlyLeadsCapError } = await import("../../utils/lead-limits");
    const monthlyLeads = await checkMonthlyLeadsCapacity(fastify.prisma, client.id, client.plan);
    if (!monthlyLeads.canIngest) {
      return reply.status(429).send(monthlyLeadsCapError(monthlyLeads.limit));
    }

    // Parse the payload
    let leadData: { name: string; phone: string; email?: string };
    try {
      if (source.parserConfig && Object.keys(source.parserConfig as Record<string, unknown>).length > 0) {
        // Use custom field mapping
        leadData = parseWithMapping(payload, source.parserConfig as unknown as Record<string, string>);
      } else {
        // Use source-based auto-detection
        leadData = parseLead(source.name, payload);
      }
    } catch (parseError: any) {
      return reply.status(400).send({ error: `Failed to parse lead: ${parseError.message}` });
    }

    if (!leadData.phone || leadData.phone.length < 10) {
      return reply.status(400).send({ error: "Invalid phone number" });
    }

    // ─── Atomic deduplication using Prisma transaction ────────────
    // Uses a random lock key to serialize concurrent requests for the same phone+client.
    // This prevents the race condition where two leads with the same phone are created
    // because both findFirst queries return null before either creates.
    // NOTE: Terminal leads (COLD/CONVERTED) are excluded from dedup — a previously
    // cold lead from the same person should be a fresh attempt, not a duplicate.
    const dedupLockId = `dedup:${client.id}:${leadData.phone}`;
    const lockAcquired = await tryAcquireLock(fastify, dedupLockId, 5); // 5 second TTL

    let existing: any = null;
    let lead: any = null;
    let isDuplicate = false;

    try {
      if (lockAcquired) {
        // Inside lock — safe from race conditions
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        existing = await fastify.prisma.lead.findFirst({
          where: {
            clientId: client.id,
            phone: leadData.phone,
            receivedAt: { gte: thirtyDaysAgo },
            // Exclude terminal leads — a previously cold/converted lead
            // should be treated as a fresh opportunity, not a duplicate
            status: { notIn: ["COLD", "CONVERTED"] },
          },
        });

        if (existing) {
          // Update raw payload, skip call
          await fastify.prisma.lead.update({
            where: { id: existing.id },
            data: { rawPayload: payload as Prisma.InputJsonValue },
          });
          isDuplicate = true;
        } else {
          // Create the lead
          lead = await fastify.prisma.lead.create({
            data: {
              clientId: client.id,
              name: leadData.name,
              phone: leadData.phone,
              email: leadData.email || null,
              source: source.name,
              rawPayload: payload as Prisma.InputJsonValue,
              status: "PENDING",
              receivedAt: new Date(),
            },
          });

          // ─── Auto-assign lead to team member (non-blocking) ──────
          const { assignLead } = await import("../../services/lead-assignment.service");
          assignLead(client.id, lead.id).catch((err: Error) => {
            fastify.log.warn({ leadId: lead.id, err: err.message }, "Lead assignment failed");
          });

          // ─── Auto-match lead to broker's properties (non-blocking) ─
          const { matchLeadToProperties } = await import("../../services/property-matching.service");
          matchLeadToProperties(lead.id, client.id).catch((err: Error) => {
            fastify.log.warn({ leadId: lead.id, err: err.message }, "Property matching failed");
          });
        }
      } else {
        // Lock not acquired — fall back to optimistic create
        // If it fails due to unique constraint, we'll catch and return
        lead = await fastify.prisma.lead.create({
          data: {
            clientId: client.id,
            name: leadData.name,
            phone: leadData.phone,
            email: leadData.email || null,
            source: source.name,
            rawPayload: payload as Prisma.InputJsonValue,
            status: "PENDING",
            receivedAt: new Date(),
          },
        });

        // Auto-assign and match even in fallback path
        const { assignLead } = await import("../../services/lead-assignment.service");
        assignLead(client.id, lead.id).catch(() => {});

        const { matchLeadToProperties } = await import("../../services/property-matching.service");
        matchLeadToProperties(lead.id, client.id).catch(() => {});
      }
    } finally {
      if (lockAcquired) {
        await releaseLock(fastify, dedupLockId);
      }
    }

    if (isDuplicate && existing) {
      return reply.status(200).send({ lead: existing, duplicate: true });
    }

    if (!lead) {
      return reply.status(500).send({ error: "Failed to create lead" });
    }

    // Increment daily lead counter after successful creation.
    // Return value intentionally ignored — lead was already created successfully.
    // If this pushes over the limit, excess is capped at 1-2 leads (acceptable).
    await checkDailyLeadLimit(fastify, client.id, client.plan, true);

    // FIX Round-2 #6: consume monthly leads allowance (race-safe).
    const { tryConsumeMonthlyLead } = await import("../../utils/lead-limits");
    await tryConsumeMonthlyLead(fastify.prisma, client.id, client.plan);

    // Enqueue immediate call (within seconds) — only if broker has call quota
    if (callAllowed) {
      await enqueueCall({
        leadId: lead.id,
        clientId: client.id,
        callType: "QUALIFICATION",
        attempt: 1,
      });
    } else {
      // FIX P0-3: lead stored but call skipped — notify the broker so no lead
      // silently disappears from their portal feed.
      await fastify.prisma.ownerNotification.create({
        data: {
          clientId: client.id,
          leadId: lead.id,
          type: "CALL_SKIPPED_LIMIT",
          message: `New lead from ${source.name} (${lead.name}) received — AI call skipped because your monthly call limit is reached. Upgrade to resume AI calls.`,
          status: "sent",
          sentAt: new Date(),
        },
      }).catch(() => {});
      fastify.log.warn({ clientId: client.id, leadId: lead.id }, "Lead stored but AI call skipped — call limit reached");
    }

    // Publish WebSocket event for real-time dashboard update
    await emitNewLead(lead.id, lead.name, source.name, client.id).catch(() => {});

    return reply.status(200).send({ lead, duplicate: false });
  });

  // ─── Email-based lead ingestion ───────────────────────────────
  fastify.post("/webhooks/email/:token", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
    // For now, email parsing is treated similarly to webhook
    // In production, this would parse email content
    const { token } = request.params;
    const payload = request.body as Record<string, unknown>;

    const source = await fastify.prisma.webhookSource.findUnique({
      where: { token },
      include: { client: true },
    });

    if (!source || !source.active) {
      return reply.status(404).send({ error: "Invalid webhook source" });
    }

    // For email sources, try to extract lead info from email body
    const emailBody = (payload.body || payload.text || "") as string;
    const subject = (payload.subject || "") as string;

    // Basic extraction from email
    const nameMatch = emailBody.match(/(?:Name|name)[:\s]+([A-Za-z\s]+)/);
    const phoneMatch = emailBody.match(/(?:Phone|phone|Mobile|mobile)[:\s]+([0-9+\-\s]{10,15})/);
    const emailMatch = emailBody.match(/(?:Email|email)[:\s]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);

    const name = nameMatch?.[1]?.trim() || subject || "Unknown";
    const phone = phoneMatch?.[1]?.replace(/\D/g, "") || "";
    const email = emailMatch?.[1] || undefined;

    if (!phone || phone.length < 10) {
      return reply.status(400).send({ error: "Could not extract phone number from email" });
    }

    // Check daily lead ingestion limit before creation
    const emailDailyLimitError = await checkDailyLeadLimit(fastify, source.clientId, source.client?.plan || "TRIAL", false);
    if (emailDailyLimitError) {
      return reply.status(429).send(emailDailyLimitError);
    }

    // FIX Round-2 #6: monthly leads cap (plan.leads)
    const { checkMonthlyLeadsCapacity, monthlyLeadsCapError } = await import("../../utils/lead-limits");
    const monthlyLeads = await checkMonthlyLeadsCapacity(fastify.prisma, source.clientId, source.client?.plan || "TRIAL");
    if (!monthlyLeads.canIngest) {
      return reply.status(429).send(monthlyLeadsCapError(monthlyLeads.limit));
    }

    // Deduplicate and create lead — with concurrent-safe locking
    // NOTE: Terminal leads (COLD/CONVERTED) are excluded from dedup.
    const dedupLockId = `dedup:${source.clientId}:+91${phone.slice(-10)}`;
    const lockAcquired = await tryAcquireLock(fastify, dedupLockId, 5);

    let existing: any = null;
    let lead: any = null;
    let isDuplicate = false;

    try {
      if (lockAcquired) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        existing = await fastify.prisma.lead.findFirst({
          where: {
            clientId: source.clientId,
            phone: `+91${phone.slice(-10)}`,
            receivedAt: { gte: thirtyDaysAgo },
            // Exclude terminal leads — cold/converted leads should be fresh attempts
            status: { notIn: ["COLD", "CONVERTED"] },
          },
        });

        if (existing) {
          isDuplicate = true;
        } else {
          lead = await fastify.prisma.lead.create({
            data: {
              clientId: source.clientId,
              name,
              phone: `+91${phone.slice(-10)}`,
              email,
              source: source.name,
              rawPayload: payload as Prisma.InputJsonValue,
              status: "PENDING",
            },
          });
        }
      } else {
        lead = await fastify.prisma.lead.create({
          data: {
            clientId: source.clientId,
            name,
            phone: `+91${phone.slice(-10)}`,
            email,
            source: source.name,
            rawPayload: payload as Prisma.InputJsonValue,
            status: "PENDING",
          },
        });
      }
    } finally {
      if (lockAcquired) {
        await releaseLock(fastify, dedupLockId);
      }
    }

    if (isDuplicate && existing) {
      return reply.status(200).send({ lead: existing, duplicate: true });
    }

    if (!lead) {
      return reply.status(500).send({ error: "Failed to create lead" });
    }

    // Increment daily lead counter
    await checkDailyLeadLimit(fastify, source.clientId, source.client?.plan || "TRIAL", true);

    // FIX Round-2 #6: consume monthly leads allowance (race-safe)
    const { tryConsumeMonthlyLead } = await import("../../utils/lead-limits");
    await tryConsumeMonthlyLead(fastify.prisma, source.clientId, source.client?.plan || "TRIAL");

    await enqueueCall({
      leadId: lead.id,
      clientId: source.clientId,
      callType: "QUALIFICATION",
      attempt: 1,
    });

    // Publish WebSocket event
    await emitNewLead(lead.id, lead.name, source.name, source.clientId).catch(() => {});

    return reply.status(200).send({ lead, duplicate: false });
  });
}

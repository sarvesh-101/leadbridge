/**
 * Shared forwarded-email processing — used by BOTH:
 *   - the inbound-email webhook (SendGrid/Mailgun/CloudMailin)
 *   - the IMAP poller (any mailbox the platform owns, e.g. forward@converza.tech)
 *
 * Pipeline: identify the broker by sender email → parse the portal email
 * (regex + LLM fallback) → enforce limits → dedup → create lead → queue AI call.
 */
import { FastifyInstance } from "fastify";
import { parseSmsLead } from "../utils/sms-lead-parser";
import { enqueueCall } from "../workers/queues";
import { emitNewLead } from "../services/websocket.service";
import { tryAcquireLock, releaseLock } from "../utils/distributed-lock";
import { logger } from "../utils/logger";

export interface ForwardedEmailParams {
  from: string; // sender email address (lowercase)
  subject?: string;
  text?: string; // plain-text body
  /** Raw details stored for debugging (provider, message id, …) */
  meta?: Record<string, unknown>;
}

export type ForwardedEmailResult =
  | { status: "created"; leadId: string }
  | { status: "duplicate" }
  | { status: "ignored"; reason: string };

/**
 * Process a forwarded portal email end-to-end. Returns a summary; the caller
 * decides the HTTP response (webhook providers expect 200 for handled events).
 */
export async function processForwardedEmail(
  fastify: FastifyInstance,
  params: ForwardedEmailParams
): Promise<ForwardedEmailResult> {
  const { from, subject, text } = params;
  const requestId = (fastify as unknown as Record<string, unknown>).requestId || "email-no-id";

  if (!from) {
    logger.warn({ requestId }, "[EMAIL] Missing sender email — ignoring");
    return { status: "ignored", reason: "no_sender" };
  }

  if (!text && !subject) {
    logger.warn({ requestId }, "[EMAIL] Empty body and subject — ignoring");
    return { status: "ignored", reason: "empty" };
  }

  // ─── Look up broker by email ─────────────────────────────────
  const client = await fastify.prisma.client.findFirst({
    where: { email: { equals: from, mode: "insensitive" } },
    select: {
      id: true,
      businessName: true,
      plan: true,
      planStatus: true,
      callsThisMonth: true,
      callsLimit: true,
      leadsThisMonth: true,
      email: true,
    },
  });

  if (!client) {
    logger.warn({ from, requestId }, "[EMAIL] No broker found for this email — ignoring");
    return { status: "ignored", reason: "no_broker" };
  }

  if (client.planStatus !== "TRIAL" && client.planStatus !== "ACTIVE") {
    logger.warn({ clientId: client.id, planStatus: client.planStatus, requestId }, "[EMAIL] Broker account inactive");
    return { status: "ignored", reason: "inactive" };
  }

  // ─── Parse the email body ──────────────────────────────────
  const searchText = `${subject || ""} ${text || ""}`;
  let parsed = parseSmsLead(searchText);

  if (!parsed || !parsed.phone) {
    logger.info({ clientId: client.id, subject: subject?.substring(0, 80), requestId }, "[EMAIL] Regex parse failed — trying LLM fallback");
    try {
      const { extractLeadFromForwardedText } = await import("../services/deepseek.service");
      const llmResult = await extractLeadFromForwardedText(searchText, "email");
      if (llmResult) {
        parsed = {
          name: llmResult.name || "Unknown",
          phone: llmResult.phone,
          email: llmResult.email,
          source: "email_forward",
          budget: llmResult.budget,
          location: llmResult.location,
          propertyType: llmResult.propertyType,
          bedrooms: llmResult.bedrooms,
        };
      }
    } catch (err: any) {
      logger.warn({ clientId: client.id, err: err.message, requestId }, "[EMAIL] LLM fallback extraction failed");
    }
  }

  if (!parsed || !parsed.phone) {
    logger.warn({ clientId: client.id, subject: subject?.substring(0, 80), requestId }, "[EMAIL] Could not parse lead from email");
    return { status: "ignored", reason: "unparseable" };
  }

  // ─── Monthly leads cap ────────────────────────────────────
  const { checkMonthlyLeadsCapacity, tryConsumeMonthlyLead } = await import("../utils/lead-limits");
  const monthlyLeads = await checkMonthlyLeadsCapacity(fastify.prisma, client.id, client.plan);
  if (!monthlyLeads.canIngest) {
    logger.warn({ clientId: client.id, requestId }, "[EMAIL] Forwarded email ignored — monthly lead limit reached");
    fastify.prisma.ownerNotification
      .create({
        data: {
          clientId: client.id,
          type: "LEAD_LIMIT",
          message: `A forwarded email lead (${parsed.name || "new lead"}) was not added — your monthly lead limit (${monthlyLeads.limit}) is reached. Upgrade your plan to add more leads.`,
          status: "sent",
          sentAt: new Date(),
        },
      })
      .catch(() => {});
    return { status: "ignored", reason: "monthly_limit" };
  }

  const callAllowed = client.plan === "PRO" || client.callsThisMonth < client.callsLimit;

  // ─── Create lead with distributed lock ───────────────────────
  const dedupLockId = `dedup:${client.id}:${parsed.phone}`;
  const lockAcquired = await tryAcquireLock(fastify, dedupLockId, 5);

  let lead: any;
  try {
    if (lockAcquired) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const existing = await fastify.prisma.lead.findFirst({
        where: {
          clientId: client.id,
          phone: parsed.phone,
          receivedAt: { gte: thirtyDaysAgo },
          status: { notIn: ["COLD", "CONVERTED"] },
        },
      });

      if (existing) {
        logger.info({ clientId: client.id, leadId: existing.id, phone: parsed.phone, requestId }, "[EMAIL] Duplicate lead — skipped");
        return { status: "duplicate" };
      }

      lead = await createLead();
    } else {
      lead = await createLead();
    }
  } finally {
    if (lockAcquired) {
      await releaseLock(fastify, dedupLockId);
    }
  }

  async function createLead() {
    return fastify.prisma.lead.create({
      data: {
        clientId: client!.id,
        name: parsed!.name,
        phone: parsed!.phone,
        email: parsed!.email || null,
        source: "email_forward",
        portalSource: parsed!.source,
        budget: parsed!.budget || null,
        location: parsed!.location || null,
        propertyType: parsed!.propertyType || null,
        bedrooms: parsed!.bedrooms || null,
        status: "PENDING",
        receivedAt: new Date(),
        rawPayload: {
          emailSubject: subject,
          senderEmail: from,
          bodyPreview: (text || "").substring(0, 500),
          portalDetected: parsed!.source,
          parsedAt: new Date().toISOString(),
          ...params.meta,
        },
      },
    });
  }

  if (!lead) {
    logger.error({ clientId: client.id, requestId }, "[EMAIL] Failed to create lead");
    return { status: "ignored", reason: "creation_failed" };
  }

  await tryConsumeMonthlyLead(fastify.prisma, client.id, client.plan);

  logger.info({ clientId: client.id, leadId: lead.id, phone: parsed.phone, source: parsed.source, requestId },
    "[EMAIL] Lead created from forwarded email");

  // ─── Background: auto-assign, property match, enqueue call ──
  Promise.allSettled([
    (async () => {
      try {
        const { assignLead } = await import("../services/lead-assignment.service");
        await assignLead(client!.id, lead.id);
      } catch { /* non-blocking */ }
    })(),
    (async () => {
      try {
        const { matchLeadToProperties } = await import("../services/property-matching.service");
        await matchLeadToProperties(lead.id, client!.id);
      } catch { /* non-blocking */ }
    })(),
    (async () => {
      try {
        if (callAllowed) {
          await enqueueCall({ leadId: lead.id, clientId: client!.id, callType: "QUALIFICATION", attempt: 1 });
        } else {
          await fastify.prisma.ownerNotification
            .create({
              data: {
                clientId: client!.id,
                leadId: lead.id,
                type: "CALL_SKIPPED_LIMIT",
                message: `New forwarded email lead (${parsed!.name}) received — AI call skipped because your monthly call limit is reached. Upgrade to resume AI calls.`,
                status: "sent",
                sentAt: new Date(),
              },
            })
            .catch(() => {});
          logger.warn({ clientId: client!.id, leadId: lead.id, requestId }, "[EMAIL] Lead stored but AI call skipped — call limit reached");
        }
      } catch { /* non-blocking */ }
    })(),
    (async () => {
      try {
        await emitNewLead(lead.id, lead.name, parsed!.source, client!.id);
      } catch { /* non-blocking */ }
    })(),
  ]);

  return { status: "created", leadId: lead.id };
}
/**
 * Monthly Leads Limit helper — FIX Round-2 #6.
 *
 * Enforces the plan.leads monthly cap (PLAN_DEFINITIONS.leads) across ALL lead
 * ingestion paths (portal webhook, SMS forward, email forward, manual entry,
 * CSV import). The counter lives on Client.leadsThisMonth and is reset together
 * with callsThisMonth in resetBrokerCycle so usage aligns with the Razorpay
 * billing cycle, not the calendar.
 */

import { PrismaClient } from "@prisma/client";
import { PLAN_DEFINITIONS } from "../services/subscription.service";
import { FAIR_USE_MINUTES_PER_LEAD } from "../config/plans";
import { enqueueCall } from "../workers/queues";

/** Fair-use ceiling in seconds (8 answered AI minutes per lead, V2 doc §1.2). */
export const FAIR_USE_SECONDS_PER_LEAD = FAIR_USE_MINUTES_PER_LEAD * 60;

/**
 * V2 (T2/T7): release leads held as QUEUED_WAITING_CREDITS, oldest first,
 * once allowance exists (plan reset / new prepaid lead credit). Allowance is
 * consumed exactly like fresh ingestion; a "none" result stops the queue.
 */
export async function releaseWaitingLeads(
  prisma: PrismaClient,
  clientId: string,
  plan: string,
  max = 500
): Promise<number> {
  const held = await prisma.lead.findMany({
    where: { clientId, status: "QUEUED_WAITING_CREDITS" },
    orderBy: { receivedAt: "asc" },
    select: { id: true },
    take: max,
  });
  let released = 0;
  for (const heldLead of held) {
    const mode = await consumeLeadAllowance(prisma, clientId, plan);
    if (mode === "none") break;
    await prisma.lead.update({
      where: { id: heldLead.id },
      data: { status: "PENDING" },
    });
    const { assignLead } = await import("../services/lead-assignment.service");
    assignLead(clientId, heldLead.id).catch(() => {});
    await enqueueCall({ leadId: heldLead.id, clientId, callType: "QUALIFICATION", attempt: 1 });
    released++;
  }
  return released;
}

/** Monthly leads allowance for a plan (defaults to GROWTH). */
export function getMonthlyLeadsLimit(plan: string): number {
  return PLAN_DEFINITIONS[plan]?.leads ?? PLAN_DEFINITIONS.GROWTH.leads;
}

/**
 * Check whether a client can ingest more leads this cycle (no increment).
 * Returns the limit (or 0 if none) and whether they're still under it.
 */
export async function checkMonthlyLeadsCapacity(
  prisma: PrismaClient,
  clientId: string,
  plan: string
): Promise<{ limit: number; used: number; canIngest: boolean }> {
  const limit = getMonthlyLeadsLimit(plan);
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { leadsThisMonth: true },
  });
  const used = client?.leadsThisMonth ?? 0;
  return { limit, used, canIngest: used < limit };
}

/**
 * Atomically consume one slot of the monthly leads allowance.
 * Returns false if the client is already at/over the cap (race-safe guard).
 */
export async function tryConsumeMonthlyLead(
  prisma: PrismaClient,
  clientId: string,
  plan: string
): Promise<boolean> {
  const limit = getMonthlyLeadsLimit(plan);
  const result = await prisma.client.updateMany({
    where: { id: clientId, leadsThisMonth: { lt: limit } },
    data: { leadsThisMonth: { increment: 1 } },
  });
  return result.count > 0;
}

/**
 * V2 (T2): where a lead's allowance came from.
 *  plan    — inside the monthly plan allowance
 *  overage — one prepaid lead credit consumed
 *  none    — nothing available (lead is held as QUEUED_WAITING_CREDITS)
 */
export type LeadAllowanceMode = "plan" | "overage" | "none";

/** Standard 429 error body for the monthly leads cap. */
export function monthlyLeadsCapError(limit: number): {
  error: string;
  limit: number;
  retryAfter: string;
} {
  return {
    error: `Monthly lead limit reached (${limit}/month). Upgrade your plan to add more leads.`,
    limit,
    retryAfter: "billing_cycle",
  };
}


/**
 * V2 (T2): atomically consume one "lead handled" slot.
 * Order per doc: plan allowance first, then prepaid overage credit
 * (one per extra lead, at the plan's overage rate — ledger logged by the
 * caller), else "none". Duplicates never reach this function.
 */
export async function consumeLeadAllowance(
  prisma: PrismaClient,
  clientId: string,
  plan: string
): Promise<LeadAllowanceMode> {
  if (await tryConsumeMonthlyLead(prisma, clientId, plan)) {
    return "plan";
  }
  // Overage: decrement prepaidLeads atomically (guard pre-paidLeads > 0).
  const consumed = await prisma.client.updateMany({
    where: { id: clientId, prepaidLeads: { gt: 0 } },
    data: { prepaidLeads: { decrement: 1 } },
  });
  if (consumed.count === 0) {
    return "none";
  }
  // Usage counter still increments so dashboards/analytics show total handled.
  await prisma.client.update({
    where: { id: clientId },
    data: { leadsThisMonth: { increment: 1 } },
  });
  return "overage";
}

/**
 * V2 (T2/T7): release leads held as QUEUED_WAITING_CREDITS, oldest first,
 * once allowance (plan rollover after reset or new prepaid credit) exists.
 * Convenience wrapper around consumeLeadAllowance used by credits lifecycle.
 */
export async function countWaitingCreditLeads(
  prisma: PrismaClient,
  clientId: string
): Promise<number> {
  return prisma.lead.count({
    where: { clientId, status: "QUEUED_WAITING_CREDITS" },
  });
}

/**
 * V2 (T2): accumulate a lead's ANSWERED seconds for the cycle. Returns true
 * exactly when the fair-use ceiling was crossed by this call (so the caller
 * can mark the lead FAIR_USE_CAP and notify the owner once).
 */
export async function recordAnsweredSeconds(
  prisma: PrismaClient,
  leadId: string,
  seconds: number
): Promise<boolean> {
  if (seconds <= 0) return false;
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { answeredSecondsThisCycle: { increment: seconds } },
    select: { answeredSecondsThisCycle: true, fairUseCappedAt: true },
  });
  // Not capped yet — ceiling not reached, or already capped (owner already notified).
  if (
    lead.answeredSecondsThisCycle < FAIR_USE_SECONDS_PER_LEAD ||
    lead.fairUseCappedAt !== null
  ) {
    return false;
  }
  await prisma.lead.update({
    where: { id: leadId },
    data: { fairUseCappedAt: new Date(), status: "FAIR_USE_CAP" },
  });
  return true;
}

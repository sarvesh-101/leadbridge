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

/**
 * Referral Tracking & Rewards Service.
 *
 * Tracks leads that were referred by existing customers.
 * Source type: "referral"
 * Referral data is stored in lead's rawPayload as { referredBy: "customer-name-or-phone" }
 *
 * REWARDS:
 * When a referred lead reaches CONVERTED or VISITED status, the broker (client)
 * gets 10 bonus call credits added to their rollover. This incentivizes brokers
 * to actively ask their customers for referrals.
 *
 * Reward: 10 call credits per converted referral
 */

import { prisma } from "../utils/prisma-shared";
import { logger } from "../utils/logger";

const REFERRAL_REWARD_CALLS = 10;

export interface ReferralStats {
  totalReferrals: number;
  convertedReferrals: number;
  conversionRate: number;
  topReferrers: Array<{ name: string; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
  rewardsGiven: number;
  totalRewardCalls: number;
}

/**
 * Get referral tracking stats for a client.
 */
export async function getReferralStats(clientId: string): Promise<ReferralStats> {
  const referralLeads = await prisma.lead.findMany({
    where: { clientId, source: "referral" },
    select: { id: true, status: true, name: true, rawPayload: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const totalReferrals = referralLeads.length;
  const convertedReferrals = referralLeads.filter((l) => l.status === "CONVERTED").length;
  const conversionRate = totalReferrals > 0 ? Math.round((convertedReferrals / totalReferrals) * 100) : 0;

  // Count rewards given from credit transactions
  const rewardTransactions = await prisma.creditTransaction.findMany({
    where: { clientId, type: "REFERRAL_REWARD" },
  });
  const totalRewardCalls = rewardTransactions.reduce((sum, t) => sum + t.minutes, 0);

  // Top referrers
  const referrerMap = new Map<string, number>();
  for (const lead of referralLeads) {
    const payload = lead.rawPayload as Record<string, unknown>;
    const referredBy = (payload.referredBy as string) || "Unknown";
    referrerMap.set(referredBy, (referrerMap.get(referredBy) || 0) + 1);
  }
  const topReferrers = Array.from(referrerMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Monthly trend
  const monthlyMap = new Map<string, number>();
  for (const lead of referralLeads) {
    const month = lead.createdAt.toISOString().slice(0, 7); // "2024-01"
    monthlyMap.set(month, (monthlyMap.get(month) || 0) + 1);
  }
  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalReferrals,
    convertedReferrals,
    conversionRate,
    topReferrers,
    monthlyTrend,
    rewardsGiven: rewardTransactions.length,
    totalRewardCalls,
  };
}

/**
 * Record a referral when creating a lead with source "referral".
 */
export async function recordReferral(
  clientId: string,
  leadId: string,
  referredBy: string
): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      source: "referral",
      rawPayload: { referredBy, referredAt: new Date().toISOString() },
    },
  });
}

/**
 * Reward the broker with bonus call credits when a referred lead converts.
 * Called automatically when a lead with source "referral" reaches VISITED or CONVERTED status.
 *
 * Reward: +10 call credits added to the broker's rolloverCalls.
 * Effectively gives the broker free capacity to make more qualification calls.
 */
export async function rewardReferralConversion(
  clientId: string,
  leadId: string
): Promise<{ rewarded: boolean; rewardCalls: number; totalRollover: number } | null> {
  try {
    // Verify this is actually a referral lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { source: true, rawPayload: true },
    });

    if (!lead || lead.source !== "referral") {
      return null; // Not a referral lead — no reward
    }

    // Check if reward was already given for this lead (idempotency)
    // CreditTransaction doesn't have a leadId field — we use metadata filtering
    const existingReward = await prisma.creditTransaction.findFirst({
      where: {
        clientId,
        type: "REFERRAL_REWARD",
        metadata: { path: ["leadId"], equals: leadId },
      },
    });
    if (existingReward) {
      return { rewarded: false, rewardCalls: 0, totalRollover: 0 };
    }

    // Give the broker bonus call credits
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { rolloverCalls: { increment: REFERRAL_REWARD_CALLS } },
    });

    // Record the reward transaction (leadId stored in metadata, not as a field)
    await prisma.creditTransaction.create({
      data: {
        type: "REFERRAL_REWARD",
        amount: 0,
        minutes: REFERRAL_REWARD_CALLS,
        description: `Referral reward: +${REFERRAL_REWARD_CALLS} call credits for lead ${leadId}`,
        clientId,
        metadata: {
          leadId,
          reward: REFERRAL_REWARD_CALLS,
          reason: "Referred lead converted",
          newRollover: updatedClient.rolloverCalls,
        },
      },
    });

    logger.info(
      { clientId, leadId, rewardCalls: REFERRAL_REWARD_CALLS, totalRollover: updatedClient.rolloverCalls },
      "Referral reward given — +10 call credits"
    );

    return { rewarded: true, rewardCalls: REFERRAL_REWARD_CALLS, totalRollover: updatedClient.rolloverCalls };
  } catch (error: any) {
    logger.warn({ clientId, leadId, err: error.message }, "Failed to process referral reward");
    return null;
  }
}

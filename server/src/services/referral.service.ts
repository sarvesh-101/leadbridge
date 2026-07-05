/**
 * Referral Tracking Service.
 *
 * Tracks leads that were referred by existing customers.
 * Source type: "referral"
 * Referral data is stored in lead's rawPayload as { referredBy: "customer-name-or-phone" }
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ReferralStats {
  totalReferrals: number;
  convertedReferrals: number;
  conversionRate: number;
  topReferrers: Array<{ name: string; count: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
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

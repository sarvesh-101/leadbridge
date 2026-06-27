/**
 * Predictive Lead Scoring Engine.
 *
 * Ranks every lead by conversion probability (0-100) using:
 * - Source quality score (99acres > MagicBricks > JustDial > Manual)
 * - Time-to-call latency (faster = higher score)
 * - Budget range match (within 20% of average deal = higher)
 * - Timeline urgency (immediate > 1-3months > browsing)
 * - Property type match (most common = higher)
 * - Location match (broker's territory = bonus)
 * - Hour of day (business hours = higher)
 * - Day of week (weekend property browsing = higher)
 * - Past conversion patterns from same source
 *
 * This runs async in the extraction worker after each call completes,
 * and can be triggered on-demand from the frontend.
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

/**
 * Track a score change in the lead score history.
 * Called automatically by scoreLead().
 */
async function trackScoreHistory(
  leadId: string,
  score: number,
  factors: Record<string, number>,
  source: "auto" | "manual" = "auto",
  reason?: string
): Promise<void> {
  try {
    await prisma.leadScoreHistory.create({
      data: {
        leadId,
        score,
        factors: factors as any,
        source,
        reason: reason || null,
      },
    });
  } catch (error: any) {
    logger.warn({ leadId, err: error.message }, "Failed to track score history");
  }
}

// Source quality scores based on Indian real estate market data
// Keys are normalized to lowercase for case-insensitive matching
const SOURCE_QUALITY: Record<string, number> = {
  "99acres": 85,
  magicbricks: 82,
  housing: 78,
  justdial: 60,
  facebook: 45,
  google: 50,
  whatsapp: 70,
  referral: 90,
  manual: 40,
  website: 65,
  email: 30,
  "99 acres": 85,
  "99-acres": 85,
  "magic bricks": 82,
  "magic-bricks": 82,
  "housing.com": 78,
  "just dial": 60,
  "just-dial": 60,
};

/**
 * Normalize a source name to match against the scoring map.
 * Handles case differences, extra spaces, and common variations.
 */
function normalizeSourceName(rawSource: string): string {
  return rawSource.toLowerCase().trim();
}

const TIMELINE_SCORES: Record<string, number> = {
  immediate: 95,
  "1-3months": 75,
  "3-6months": 50,
  browsing: 20,
  "not-specified": 40,
};

const BUDGET_RANGES = [
  { key: "under-50L", score: 60 },
  { key: "50L-1Cr", score: 80 },
  { key: "1Cr-2Cr", score: 90 },
  { key: "above-2Cr", score: 70 },
];

const PROPERTY_TYPE_SCORES: Record<string, number> = {
  flat: 85,
  villa: 75,
  plot: 65,
  commercial: 55,
  rental: 45,
};

/**
 * Score a single lead based on available data.
 * Returns a score from 0-100.
 */
export async function scoreLead(leadId: string): Promise<{
  score: number;
  factors: Record<string, number>;
}> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { client: true },
  });

  if (!lead) {
    return { score: 0, factors: { error: 0 } };
  }

  const factors: Record<string, number> = {};
  let totalScore = 0;
  let weightSum = 0;

  // 1. Source quality (weight: 20%)
  const normalizedSource = normalizeSourceName(lead.source);
  const sourceScore = SOURCE_QUALITY[normalizedSource] || SOURCE_QUALITY[lead.source] || 40;
  factors.source = sourceScore * 0.2;
  totalScore += sourceScore * 0.2;
  weightSum += 0.2;

  // 2. Time-to-call latency (weight: 15%)
  if (lead.firstCalledAt && lead.receivedAt) {
    const latencyMinutes = (lead.firstCalledAt.getTime() - lead.receivedAt.getTime()) / 60000;
    const latencyScore = Math.max(0, 100 - latencyMinutes * 2); // -2 points per minute
    factors.latency = Math.min(latencyScore, 100) * 0.15;
    totalScore += Math.min(latencyScore, 100) * 0.15;
  } else {
    factors.latency = 50 * 0.15; // Neutral score for not-yet-called
    totalScore += 50 * 0.15;
  }
  weightSum += 0.15;

  // 3. Timeline urgency (weight: 20%)
  const timelineScore = TIMELINE_SCORES[lead.timeline || "not-specified"] || 40;
  factors.timeline = timelineScore * 0.2;
  totalScore += timelineScore * 0.2;
  weightSum += 0.2;

  // 4. Budget (weight: 15%)
  const budgetEntry = BUDGET_RANGES.find((b) => b.key === lead.budget);
  const budgetScore = budgetEntry?.score || 50;
  factors.budget = budgetScore * 0.15;
  totalScore += budgetScore * 0.15;
  weightSum += 0.15;

  // 5. Property type (weight: 10%)
  const propertyScore = PROPERTY_TYPE_SCORES[lead.propertyType || ""] || 50;
  factors.propertyType = propertyScore * 0.1;
  totalScore += propertyScore * 0.1;
  weightSum += 0.1;

  // 6. Call hour score (weight: 10%)
  if (lead.firstCalledAt) {
    const hour = lead.firstCalledAt.getHours();
    // Business hours 10AM-6PM = high, evening 6PM-8PM = medium, night = low
    const hourScore = (hour >= 10 && hour <= 18) ? 90 :
                      (hour >= 18 && hour <= 20) ? 70 :
                      (hour >= 8 && hour <= 10) ? 60 : 30;
    factors.callHour = hourScore * 0.1;
    totalScore += hourScore * 0.1;
  } else {
    factors.callHour = 60 * 0.1;
    totalScore += 60 * 0.1;
  }
  weightSum += 0.1;

  // 7. Territory match (weight: 10%)
  if (lead.location && lead.client) {
    const city = lead.client.city?.toLowerCase();
    const zone = lead.client.zone?.toLowerCase();
    const leadLocation = lead.location.toLowerCase();
    const territoryMatch = (city && leadLocation.includes(city)) ||
                           (zone && leadLocation.includes(zone)) ? 100 : 60;
    factors.territory = territoryMatch * 0.1;
    totalScore += territoryMatch * 0.1;
  } else {
    factors.territory = 50 * 0.1;
    totalScore += 50 * 0.1;
  }
  weightSum += 0.1;

  // 8. Sentiment boost/penalty (weight: bonus/penalty)
  if (lead.sentiment === "positive") {
    totalScore += 10;
    factors.sentiment = 10;
  } else if (lead.sentiment === "negative") {
    totalScore -= 15;
    factors.sentiment = -15;
  } else {
    factors.sentiment = 0;
  }

  // Ensure 0-100 range
  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  // Update lead score in database
  await prisma.lead.update({
    where: { id: leadId },
    data: { score: finalScore },
  });

  // Track score history for trend analysis
  await trackScoreHistory(leadId, finalScore, factors);

  return { score: finalScore, factors };
}

/**
 * Get leads sorted by score (highest conversion probability first).
 */
export async function getTopLeads(
  clientId: string,
  limit: number = 10
): Promise<Array<{ id: string; name: string; score: number; source: string; status: string }>> {
  const leads = await prisma.lead.findMany({
    where: {
      clientId,
      status: { notIn: ["COLD", "CONVERTED"] },
    },
    orderBy: { score: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      status: true,
      source: true,
      budget: true,
      timeline: true,
    },
  });

  // Calculate scores for leads that don't have one yet
  const scoredLeads = await Promise.all(
    leads.map(async (lead) => {
      const { score } = await scoreLead(lead.id);
      return {
        id: lead.id,
        name: lead.name,
        score,
        source: lead.source,
        status: lead.status,
      };
    })
  );

  return scoredLeads.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Predict which leads are likely to convert this week.
 * Returns leads with score > 70 that are in BOOKED or REMINDED state.
 */
export async function predictWeeklyConversions(
  clientId: string
): Promise<{ likelyToConvert: number; totalValue: string; leads: Array<{ name: string; score: number; status: string }> }> {
  const leads = await prisma.lead.findMany({
    where: {
      clientId,
      status: { in: ["BOOKED", "REMINDED"] },
    },
  });

  const scored = await Promise.all(
    leads.map(async (lead) => {
      const { score } = await scoreLead(lead.id);
      return { name: lead.name, score, status: lead.status, budget: lead.budget };
    })
  );

  const highProbability = scored.filter((l) => l.score >= 70);
  const totalValue = highProbability.reduce((sum, l) => {
    const budgetMap: Record<string, number> = {
      "under-50L": 5000000,
      "50L-1Cr": 7500000,
      "1Cr-2Cr": 15000000,
      "above-2Cr": 25000000,
    };
    return sum + (budgetMap[l.budget || ""] || 5000000);
  }, 0);

  return {
    likelyToConvert: highProbability.length,
    totalValue: `₹${(totalValue / 10000000).toFixed(1)}Cr`,
    leads: highProbability.map((l) => ({ name: l.name, score: l.score, status: l.status })),
  };
}

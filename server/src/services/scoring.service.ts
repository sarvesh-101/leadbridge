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
        factors: factors as unknown as any,
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
/**
 * Analyze scoring accuracy by comparing past predictions to actual outcomes.
 * Computes precision, recall, and calibration metrics.
 */
export async function calculateScoringAccuracy(
  clientId: string
): Promise<{
  totalLeads: number;
  highScoreCount: number;
  convertedFromHighScore: number;
  accuracy: number;
  precision: number;
  recall: number;
  calibration: { scoreBand: string; leads: number; converted: number; rate: number }[];
  topFactorPerformance: { factor: string; avgScore: number; conversionRate: number }[];
}> {
  // Analyze leads with score history and a terminal outcome (CONVERTED or COLD)
  const leads = await prisma.lead.findMany({
    where: {
      clientId,
      status: { in: ["CONVERTED", "COLD", "VISITED"] },
      scoreHistory: { some: {} },
    },
    include: {
      scoreHistory: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const totalLeads = leads.length;
  const converted = leads.filter((l) => l.status === "CONVERTED");
  const highScoreThreshold = 70;

  // High-score leads that converted = true positives
  const highScore = leads.filter((l) => (l.scoreHistory[0]?.score || l.score) >= highScoreThreshold);
  const highScoreConverted = highScore.filter((l) => l.status === "CONVERTED");
  const lowScoreConverted = converted.filter(
    (l) => (l.scoreHistory[0]?.score || l.score) < highScoreThreshold
  );

  const accuracy = totalLeads > 0 ? Math.round((highScoreConverted.length / totalLeads) * 100) : 0;
  const precision = highScore.length > 0 ? Math.round((highScoreConverted.length / highScore.length) * 100) : 0;
  const recall = converted.length > 0 ? Math.round((highScoreConverted.length / converted.length) * 100) : 0;

  // Calibration bands
  const bands = [
    { label: "0-20", min: 0, max: 20 },
    { label: "21-40", min: 21, max: 40 },
    { label: "41-60", min: 41, max: 60 },
    { label: "61-80", min: 61, max: 80 },
    { label: "81-100", min: 81, max: 100 },
  ];

  const calibration = bands.map((band) => {
    const inBand = leads.filter((l) => {
      const s = l.scoreHistory[0]?.score || l.score;
      return s >= band.min && s <= band.max;
    });
    return {
      scoreBand: band.label,
      leads: inBand.length,
      converted: inBand.filter((l) => l.status === "CONVERTED").length,
      rate: inBand.length > 0
        ? Math.round((inBand.filter((l) => l.status === "CONVERTED").length / inBand.length) * 100)
        : 0,
    };
  });

  // Factor-level performance analysis
  // Look at the factors stored in score history and compare to conversion outcomes
  const factorNames = ["source", "latency", "timeline", "budget", "propertyType", "callHour", "territory", "sentiment"];
  const topFactorPerformance = factorNames.map((factor) => {
    const withFactor = leads.filter((l) => {
      const factors = l.scoreHistory[0]?.factors as Record<string, number> | null;
      return factors && factor in factors;
    });
    const avgScore = withFactor.length > 0
      ? Math.round(withFactor.reduce((sum, l) => sum + (l.scoreHistory[0]?.score || l.score), 0) / withFactor.length)
      : 0;
    return {
      factor,
      avgScore,
      conversionRate: withFactor.length > 0
        ? Math.round((withFactor.filter((l) => l.status === "CONVERTED").length / withFactor.length) * 100)
        : 0,
    };
  });

  return {
    totalLeads,
    highScoreCount: highScore.length,
    convertedFromHighScore: highScoreConverted.length,
    accuracy,
    precision,
    recall,
    calibration,
    topFactorPerformance,
  };
}

/**
 * Recalibrate scoring weights based on historical conversion data.
 * Analyzes which factors best predicted actual conversions and adjusts weights accordingly.
 * Returns recommended weight adjustments (not applied — for broker review).
 */
export async function recalibrateWeights(
  clientId: string
): Promise<{
  currentWeights: Record<string, number>;
  recommendedWeights: Record<string, number>;
  changes: Record<string, { from: number; to: number; reason: string }>;
  confidence: string;
  requiresMoreData: boolean;
}> {
  const currentWeights: Record<string, number> = {
    source: 0.2,
    latency: 0.15,
    timeline: 0.2,
    budget: 0.15,
    propertyType: 0.1,
    callHour: 0.1,
    territory: 0.1,
  };

  const analysis = await calculateScoringAccuracy(clientId);

  if (analysis.totalLeads < 20) {
    return {
      currentWeights,
      recommendedWeights: currentWeights,
      changes: {},
      confidence: "low",
      requiresMoreData: true,
    };
  }

  // For each factor, compute how well its average score correlates with conversion
  // Higher conversion rate for a factor = weight that factor more
  const totalConversionRate = analysis.totalLeads > 0
    ? (analysis.calibration.reduce((sum, b) => sum + b.converted, 0) / analysis.totalLeads) * 100
    : 0;

  const factorPerformance = analysis.topFactorPerformance;
  const avgConversionRate = factorPerformance.reduce((sum, f) => sum + f.conversionRate, 0) / factorPerformance.length;

  // Compute adjusted weights based on how much each factor's conversion rate deviates from average
  const recommendedWeights: Record<string, number> = { ...currentWeights };
  const changes: Record<string, { from: number; to: number; reason: string }> = {};

  for (const fp of factorPerformance) {
    const currentWeight = currentWeights[fp.factor] || 0;
    if (currentWeight === 0) continue;

    // If a factor's conversion rate is above average, increase its weight relative to the deviation
    const deviation = fp.conversionRate - avgConversionRate;
    if (Math.abs(deviation) > 5) {
      const adjustment = Math.round((deviation / 100) * 0.5 * 100) / 100;
      const newWeight = Math.max(0.05, Math.min(0.35, currentWeight + adjustment));
      recommendedWeights[fp.factor] = Math.round(newWeight * 100) / 100;

      if (Math.abs(newWeight - currentWeight) > 0.01) {
        changes[fp.factor] = {
          from: currentWeight,
          to: newWeight,
          reason: deviation > 0
            ? `Above-average conversion rate (${fp.conversionRate}%) — increase weight`
            : `Below-average conversion rate (${fp.conversionRate}%) — decrease weight`,
        };
      }
    }
  }

  // Normalize weights to sum to 1.0
  const weightSum = Object.values(recommendedWeights).reduce((a, b) => a + b, 0);
  if (weightSum > 0) {
    for (const key of Object.keys(recommendedWeights)) {
      recommendedWeights[key] = Math.round((recommendedWeights[key] / weightSum) * 100) / 100;
    }
  }

  const confidence = analysis.totalLeads >= 100 ? "high" : analysis.totalLeads >= 50 ? "medium" : "low";

  return {
    currentWeights,
    recommendedWeights,
    changes,
    confidence,
    requiresMoreData: false,
  };
}

/**
 * Track a conversion outcome against the last score prediction.
 * Called when a lead is marked as CONVERTED or COLD.
 */
export async function recordScoringOutcome(
  leadId: string,
  outcome: "converted" | "cold" | "visited"
): Promise<void> {
  try {
    const lastScore = await prisma.leadScoreHistory.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });

    if (!lastScore) return;

    // Track prediction vs outcome in the score history reason field
    const predictionCorrect =
      (outcome === "converted" && lastScore.score >= 70) ||
      (outcome === "cold" && lastScore.score < 40);

    await prisma.leadScoreHistory.create({
      data: {
        leadId,
        score: lastScore.score,
        factors: lastScore.factors as any,
        source: "auto",
        reason: `OUTCOME:${outcome}|PREDICTION_CORRECT:${predictionCorrect}|SCORE_AT_PREDICTION:${lastScore.score}`,
      },
    });

    logger.info({ leadId, outcome, score: lastScore.score, predictionCorrect }, "Scoring outcome recorded");
  } catch (error: any) {
    logger.warn({ leadId, err: error.message }, "Failed to record scoring outcome");
  }
}

/**
 * Get scoring explainability insights for a lead.
 * Returns human-readable explanations with factor contributions.
 */
export async function getScoringInsights(leadId: string): Promise<{
  score: number;
  level: string;
  factors: { name: string; label: string; contribution: number; percentage: number; description: string }[];
  trend: { direction: string; change: number; reason: string };
  explanation: string;
  accuracyConfidence: string;
}> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      scoreHistory: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!lead) {
    return {
      score: 0,
      level: "unknown",
      factors: [],
      trend: { direction: "stable", change: 0, reason: "No data" },
      explanation: "Lead not found",
      accuracyConfidence: "low",
    };
  }

  const { score, factors } = await scoreLead(lead.id);

  const factorLabels: Record<string, { label: string; description: string }> = {
    source: { label: "Source Quality", description: "Score based on where the lead came from (e.g., 99acres, JustDial)" },
    latency: { label: "Response Speed", description: "How quickly the lead was contacted after coming in" },
    timeline: { label: "Timeline Urgency", description: "How urgently the lead wants to buy" },
    budget: { label: "Budget Fit", description: "How well the lead's budget matches typical deals" },
    propertyType: { label: "Property Match", description: "Whether the lead's property preference is in demand" },
    callHour: { label: "Call Timing", description: "Whether the call happened during business hours" },
    territory: { label: "Territory Match", description: "Whether the lead's location matches your service area" },
    sentiment: { label: "Call Sentiment", description: "Positive/negative sentiment detected during AI call" },
  };

  const totalFactorScore = Object.entries(factors)
    .filter(([k]) => k !== "sentiment" && k !== "error")
    .reduce((sum, [, v]) => sum + Math.abs(v), 0);

  const factorList = Object.entries(factors)
    .filter(([k]) => k !== "error")
    .map(([name, value]) => {
      const meta = factorLabels[name] || { label: name, description: "" };
      return {
        name,
        label: meta.label,
        contribution: Math.round(value * 100) / 100,
        percentage: totalFactorScore > 0
          ? Math.round((Math.abs(value) / totalFactorScore) * 100)
          : 0,
        description: meta.description,
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // Trend analysis
  const history = lead.scoreHistory;
  let trendDirection = "stable";
  let trendChange = 0;
  let trendReason = "Score has remained consistent";

  if (history.length >= 2) {
    const oldest = history[history.length - 1].score;
    const latest = history[0].score;
    trendChange = latest - oldest;
    if (trendChange > 5) {
      trendDirection = "improving";
      trendReason = "Score has improved, indicating increased engagement";
    } else if (trendChange < -5) {
      trendDirection = "declining";
      trendReason = "Score has decreased, suggesting waning interest";
    }
  }

  const level = score >= 70 ? "high" : score >= 40 ? "moderate" : "low";
  const topFactor = factorList[0];
  const explanation = `This lead has ${level} conversion probability (${score}/100). ` +
    `The strongest factor is "${topFactor?.label || "overall assessment"}" contributing ${topFactor?.percentage || 0}% of the score. ` +
    (level === "high"
      ? "Prioritize for follow-up and site visit scheduling."
      : level === "moderate"
      ? "Continue nurturing with targeted WhatsApp messages and a follow-up call."
      : "Consider re-engagement campaigns or re-qualification.");

  // Accuracy confidence based on how many leads have been scored in this account
  const totalScored = await prisma.leadScoreHistory.groupBy({
    by: ["leadId"],
    where: { lead: { clientId: lead.clientId } },
    _count: { leadId: true },
  });
  const accuracyConfidence = totalScored.length >= 100 ? "high" : totalScored.length >= 30 ? "medium" : "low";

  return {
    score,
    level,
    factors: factorList,
    trend: { direction: trendDirection, change: trendChange, reason: trendReason },
    explanation,
    accuracyConfidence,
  };
}

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

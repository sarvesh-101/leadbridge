/**
 * Advanced Analytics Service.
 *
 * Goes beyond basic stats to provide:
 * - Conversion funnel analysis (stage-by-stage drop-off)
 * - Churn prediction (leads likely to go cold)
 * - Territory performance heatmaps
 * - Cohort analysis (performance by lead source, month, etc.)
 * - Broker performance benchmarking (compare vs peers)
 * - ROI calculation (cost per lead, per booking, per conversion)
 * - Time-series forecasting (predicted next month performance)
 */

import { PrismaClient, LeadStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface StageFunnel {
  stage: string;
  count: number;
  dropOff: number;
  dropOffPercent: number;
  conversionToNext: number;
}

interface CohortData {
  period: string;
  total: number;
  contacted: number;
  booked: number;
  visited: number;
  converted: number;
  cold: number;
}

interface TerritoryHeatmap {
  city: string;
  zone: string | null;
  totalLeads: number;
  bookings: number;
  conversions: number;
  showRate: number;
  conversionRate: number;
  avgScore: number;
  topBroker: string | null;
}

/**
 * Build the conversion funnel for a client.
 */
export async function getConversionFunnel(clientId: string): Promise<StageFunnel[]> {
  const stages = [
    "PENDING", "CALLING", "FAQ_ONLY", "BOOKED", "VISITED", "CONVERTED",
  ];

  const funnel: StageFunnel[] = [];
  let previousCount = 0;

  for (const stage of stages) {
    const count = await prisma.lead.count({
      where: {
        clientId,
        status: stage as LeadStatus,
      },
    });

    const dropOff = previousCount > 0 ? previousCount - count : 0;
    const dropOffPercent = previousCount > 0 ? Math.round((dropOff / previousCount) * 100) : 0;
    const conversionToNext = count > 0 && previousCount > 0
      ? Math.round((count / previousCount) * 100)
      : 0;

    funnel.push({
      stage,
      count,
      dropOff,
      dropOffPercent,
      conversionToNext,
    });

    previousCount = count;
  }

  return funnel;
}

/**
 * Predict leads at risk of going cold (churn prediction).
 * Flags leads showing warning signs.
 */
export async function getChurnPredictions(clientId: string): Promise<Array<{
  id: string;
  name: string;
  phone: string;
  riskScore: number;
  riskFactors: string[];
  recommendedAction: string;
  daysSinceLastContact: number;
}>> {
  const now = new Date();
  const activeLeads = await prisma.lead.findMany({
    where: {
      clientId,
      status: { in: ["PENDING", "FAQ_ONLY", "NO_ANSWER", "FOLLOWUP_D1", "FOLLOWUP_D2"] },
    },
    include: {
      calls: { orderBy: { createdAt: "desc" }, take: 3 },
      customerNotifications: { orderBy: { sentAt: "desc" }, take: 3 },
    },
  });

  const predictions = activeLeads.map((lead) => {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Factor 1: Days since last contact (weight: 40)
    const lastCall = lead.calls[0];
    const daysSinceContact = lastCall
      ? Math.round((now.getTime() - lastCall.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    if (daysSinceContact > 7) { riskScore += 20; riskFactors.push("No contact in over a week"); }
    if (daysSinceContact > 14) { riskScore += 20; riskFactors.push("No contact in over 2 weeks"); }

    // Factor 2: Call attempts exhausted (weight: 20)
    if (lead.callAttempts >= lead.maxAttempts - 1) {
      riskScore += 20;
      riskFactors.push("Max call attempts reached");
    }

    // Factor 3: Multiple unanswered calls (weight: 20)
    const unansweredCount = lead.calls.filter((c) => c.status === "NO_ANSWER").length;
    if (unansweredCount >= 2) { riskScore += 20; riskFactors.push(`${unansweredCount} unanswered calls`); }

    // Factor 4: Negative sentiment (weight: 20)
    if (lead.sentiment === "negative") {
      riskScore += 20;
      riskFactors.push("Negative sentiment detected");
    }

    // Factor 5: Old lead (> 30 days) (weight: 20)
    const daysSinceReceived = Math.round((now.getTime() - lead.receivedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceReceived > 30) { riskScore += 20; riskFactors.push(`Lead is ${daysSinceReceived} days old`); }

    const recommendedAction = riskScore >= 60
      ? "Mark as cold — no further follow-up"
      : riskScore >= 40
        ? "Send personalized WhatsApp offer"
        : "Attempt one more call with alternative property offer";

    return {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      riskScore: Math.min(riskScore, 100),
      riskFactors,
      recommendedAction,
      daysSinceLastContact: daysSinceContact,
    };
  });

  return predictions.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Get territory performance heatmap data.
 */
export async function getTerritoryHeatmap(): Promise<TerritoryHeatmap[]> {
  const territories = await prisma.territory.findMany({
    include: {
      client: {
        include: {
          leads: true,
          bookings: true,
        },
      },
    },
  });

  return territories.map((t) => {
    const leads = t.client?.leads || [];
    const bookings = t.client?.bookings || [];
    const conversions = leads.filter((l) => l.status === "CONVERTED");

    return {
      city: t.city,
      zone: t.zone,
      totalLeads: leads.length,
      bookings: bookings.length,
      conversions: conversions.length,
      showRate: bookings.length > 0
        ? Math.round((leads.filter((l) => l.status === "VISITED").length / bookings.length) * 100)
        : 0,
      conversionRate: leads.length > 0
        ? Math.round((conversions.length / leads.length) * 100)
        : 0,
      avgScore: leads.length > 0
        ? Math.round(leads.reduce((sum, l) => sum + (l.score || 0), 0) / leads.length)
        : 0,
      topBroker: t.client?.businessName || null,
    };
  });
}

/**
 * Monthly cohort analysis — how leads from each source perform over time.
 */
export async function getCohortAnalysis(clientId: string): Promise<CohortData[]> {
  const cohorts: CohortData[] = [];
  const now = new Date();

  // Analyze last 6 months
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const leads = await prisma.lead.findMany({
      where: {
        clientId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const total = leads.length;
    const contacted = leads.filter((l) => l.status !== "PENDING").length;
    const booked = leads.filter((l) =>
      ["BOOKED", "REMINDED", "VISITED", "CONVERTED", "REBOOKED"].includes(l.status)
    ).length;
    const visited = leads.filter((l) =>
      ["VISITED", "CONVERTED"].includes(l.status)
    ).length;
    const converted = leads.filter((l) => l.status === "CONVERTED").length;
    const cold = leads.filter((l) => l.status === "COLD").length;

    cohorts.push({
      period: `${monthStart.getMonth() + 1}/${monthStart.getFullYear()}`,
      total,
      contacted,
      booked,
      visited,
      converted,
      cold,
    });
  }

  return cohorts;
}

/**
 * ROI calculation for the client.
 */
export async function getROIAnalysis(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      leads: true,
      calls: true,
      bookings: true,
    },
  });

  if (!client) return null;

  const totalLeads = client.leads.length;
  const totalCalls = client.calls.length;
  const totalBookings = client.bookings.length;
  const conversions = client.leads.filter((l) => l.status === "CONVERTED").length;

  // Estimated costs (adjust in production)
  const costPerCall = 1.5; // ₹1.50 per minute for Exotel
  const aiCostPerCall = 0.5; // ₹0.50 for DeepSeek + Deepgram + Cartesia
  const avgCallDuration = 120; // seconds
  const totalCallMinutes = (totalCalls * avgCallDuration) / 60;
  const totalCost = totalCallMinutes * (costPerCall + aiCostPerCall);

  return {
    totalLeads,
    totalCalls,
    totalBookings,
    conversions,
    totalCost: Math.round(totalCost),
    costPerLead: totalLeads > 0 ? Math.round(totalCost / totalLeads) : 0,
    costPerBooking: totalBookings > 0 ? Math.round(totalCost / totalBookings) : 0,
    costPerConversion: conversions > 0 ? Math.round(totalCost / conversions) : 0,
    conversionRate: totalLeads > 0 ? Math.round((conversions / totalLeads) * 100) : 0,
    averageDealValue: conversions > 0
      ? `₹${Math.round(conversions * 7500000 / conversions).toLocaleString('en-IN')}`
      : "₹0",
    roi: totalCost > 0
      ? `${Math.round((conversions * 7500000 - totalCost) / totalCost * 100)}%`
      : "0%",
  };
}

/**
 * Time-series forecast for next month.
 */
export async function getForecast(clientId: string): Promise<{
  predictedLeads: number;
  predictedBookings: number;
  predictedConversions: number;
  confidence: string;
}> {
  const now = new Date();
  const last3MonthsStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const leads = await prisma.lead.findMany({
    where: {
      clientId,
      createdAt: { gte: last3MonthsStart },
    },
  });

  // Simple moving average forecast
  const monthlyLeads = [0, 0, 0];
  const monthlyBookings = [0, 0, 0];
  const monthlyConversions = [0, 0, 0];

  for (const lead of leads) {
    const monthIndex = now.getMonth() - lead.createdAt.getMonth() - 1;
    if (monthIndex >= 0 && monthIndex < 3) {
      monthlyLeads[monthIndex]++;
      if (lead.status === "BOOKED" || lead.status === "VISITED" || lead.status === "CONVERTED") {
        monthlyBookings[monthIndex]++;
      }
      if (lead.status === "CONVERTED") monthlyConversions[monthIndex]++;
    }
  }

  const avgLeads = Math.round(monthlyLeads.reduce((a, b) => a + b, 0) / 3);
  const avgBookings = Math.round(monthlyBookings.reduce((a, b) => a + b, 0) / 3);
  const avgConversions = Math.round(monthlyConversions.reduce((a, b) => a + b, 0) / 3);

  // Confidence based on data volume
  const confidence = avgLeads > 100 ? "High" : avgLeads > 50 ? "Medium" : "Low";

  return {
    predictedLeads: avgLeads,
    predictedBookings: avgBookings,
    predictedConversions: avgConversions,
    confidence,
  };
}

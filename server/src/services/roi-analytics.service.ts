/**
 * Lead Source ROI Analytics Service.
 *
 * Tracks cost-per-lead by source, conversion rates, and source quality trending over time.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SourceROI {
  source: string;
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  totalCost: number;
  costPerLead: number;
  costPerConversion: number;
  avgScore: number;
  trend: "up" | "down" | "stable";
}

/**
 * Get ROI analytics for all lead sources.
 */
export async function getSourceROI(clientId: string): Promise<{
  sources: SourceROI[];
  summary: { totalSpend: number; avgCpl: number; bestSource: string };
}> {
  const leads = await prisma.lead.findMany({
    where: { clientId },
    select: { source: true, status: true, score: true, budget: true, createdAt: true },
  });

  // Group by source
  const groups: Record<string, { leads: typeof leads; costs: number[] }> = {};

  for (const lead of leads) {
    if (!groups[lead.source]) groups[lead.source] = { leads: [], costs: [] };
    groups[lead.source].leads.push(lead);
  }

  // Try to load source cost config from client
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { leadSources: true },
  });

  const sourceCosts: Record<string, number> = {};
  if (client?.leadSources) {
    const sources = client.leadSources as Array<{ name: string; costPerLead?: number }>;
    for (const s of sources) {
      if (s.name && s.costPerLead != null) sourceCosts[s.name] = s.costPerLead;
    }
  }

  const sources: SourceROI[] = Object.entries(groups).map(([source, group]) => {
    const totalLeads = group.leads.length;
    const conversions = group.leads.filter((l) => l.status === "CONVERTED").length;
    const avgScore =
      totalLeads > 0
        ? Math.round(group.leads.reduce((s, l) => s + (l.score || 0), 0) / totalLeads)
        : 0;
    const costPerLead = sourceCosts[source] || 0;
    const totalCost = costPerLead * totalLeads;
    const costPerConversion = conversions > 0 ? totalCost / conversions : 0;

    // Trend: compare first half vs second half conversion rate
    const sorted = [...group.leads].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);
    const firstConvRate = firstHalf.length > 0
      ? firstHalf.filter((l) => l.status === "CONVERTED").length / firstHalf.length
      : 0;
    const secondConvRate = secondHalf.length > 0
      ? secondHalf.filter((l) => l.status === "CONVERTED").length / secondHalf.length
      : 0;
    const trend: "up" | "down" | "stable" =
      secondConvRate > firstConvRate * 1.1
        ? "up"
        : secondConvRate < firstConvRate * 0.9
          ? "down"
          : "stable";

    return {
      source,
      totalLeads,
      conversions,
      conversionRate: totalLeads > 0 ? Math.round((conversions / totalLeads) * 100) : 0,
      totalCost,
      costPerLead,
      costPerConversion: Math.round(costPerConversion * 100) / 100,
      avgScore,
      trend,
    };
  });

  const totalSpend = sources.reduce((s, src) => s + src.totalCost, 0);
  const totalLeadsCount = sources.reduce((s, src) => s + src.totalLeads, 0);
  const avgCpl = totalLeadsCount > 0 ? Math.round(totalSpend / totalLeadsCount) : 0;
  const bestSource =
    sources.length > 0
      ? sources.reduce((best, src) =>
          src.conversionRate > (best.conversionRate || 0) ? src : best
        ).source
      : "—";

  return {
    sources: sources.sort((a, b) => b.totalLeads - a.totalLeads),
    summary: { totalSpend, avgCpl, bestSource },
  };
}

/**
 * Update the cost-per-lead for a source.
 */
export async function updateSourceCost(
  clientId: string,
  source: string,
  costPerLead: number
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { leadSources: true },
  });

  const sources = (client?.leadSources as Array<{ name: string; costPerLead?: number }>) || [];

  const existing = sources.find((s) => s.name === source);
  if (existing) {
    existing.costPerLead = costPerLead;
  } else {
    sources.push({ name: source, costPerLead });
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { leadSources: sources as any },
  });
}

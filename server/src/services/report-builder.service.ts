/**
 * Custom Report Builder Service.
 *
 * Allows brokers to create custom analytics reports with:
 * - Custom date ranges (from/to)
 * - Filter by lead fields (source, status, location, score)
 * - Group by (day, week, month, source, status)
 * - Export to CSV
 * - Schedule recurring email delivery
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  source?: string[];
  status?: string[];
  location?: string;
  minScore?: number;
  maxScore?: number;
}

interface ReportGroupBy {
  type: "day" | "week" | "month" | "source" | "status";
}

interface ReportResult {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
  summary: Record<string, number | string>;
}

const CHART_COLORS = ["#4F6EF7", "#22D3A5", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];

/**
 * Generate a custom report with the specified filters and grouping.
 */
export async function generateReport(
  clientId: string,
  filters: ReportFilter,
  groupBy: ReportGroupBy
): Promise<ReportResult> {
  const where: Record<string, unknown> = { clientId };

  if (filters.dateFrom || filters.dateTo) {
    where.receivedAt = {};
    if (filters.dateFrom) (where.receivedAt as Record<string, unknown>).gte = new Date(filters.dateFrom);
    if (filters.dateTo) (where.receivedAt as Record<string, unknown>).lte = new Date(filters.dateTo);
  }
  if (filters.source && filters.source.length > 0) {
    where.source = { in: filters.source };
  }
  if (filters.status && filters.status.length > 0) {
    where.status = { in: filters.status };
  }

  const leads = await prisma.lead.findMany({
    where,
    select: {
      source: true,
      status: true,
      score: true,
      receivedAt: true,
      location: true,
      budget: true,
    },
  });

  if (groupBy.type === "source") {
    return generateSourceReport(leads);
  } else if (groupBy.type === "status") {
    return generateStatusReport(leads);
  } else {
    return generateTimeSeriesReport(leads, groupBy.type);
  }
}

function generateSourceReport(leads: any[]): ReportResult {
  const counts: Record<string, number> = {};
  const converted: Record<string, number> = {};

  for (const lead of leads) {
    counts[lead.source] = (counts[lead.source] || 0) + 1;
    if (lead.status === "CONVERTED") converted[lead.source] = (converted[lead.source] || 0) + 1;
  }

  const sources = Object.keys(counts).sort();
  return {
    labels: sources.map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
    datasets: [
      { label: "Leads", data: sources.map((s) => counts[s]), color: CHART_COLORS[0] },
      { label: "Conversions", data: sources.map((s) => converted[s] || 0), color: CHART_COLORS[1] },
    ],
    summary: {
      totalLeads: leads.length,
      totalConversions: Object.values(converted).reduce((a, b) => a + b, 0),
      avgScore: leads.length > 0 ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / leads.length) : 0,
    },
  };
}

function generateStatusReport(leads: any[]): ReportResult {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    counts[lead.status] = (counts[lead.status] || 0) + 1;
  }
  const statuses = Object.keys(counts).sort();
  return {
    labels: statuses.map((s) => s.replace(/_/g, " ")),
    datasets: [{ label: "Leads", data: statuses.map((s) => counts[s]), color: CHART_COLORS[0] }],
    summary: { totalLeads: leads.length },
  };
}

function generateTimeSeriesReport(leads: any[], interval: "day" | "week" | "month"): ReportResult {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    const d = new Date(lead.receivedAt);
    const key = interval === "day"
      ? d.toISOString().split("T")[0]
      : interval === "week"
      ? `W${getWeekNumber(d)}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  const sortedKeys = Object.keys(counts).sort();
  return {
    labels: sortedKeys,
    datasets: [{ label: "Leads over time", data: sortedKeys.map((k) => counts[k]), color: CHART_COLORS[0] }],
    summary: { totalLeads: leads.length, period: interval },
  };
}

function getWeekNumber(d: Date): number {
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - startOfYear.getTime();
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
}

/**
 * Export report data as CSV.
 */
export function reportToCsv(result: ReportResult): string {
  const headers = ["Label", ...result.datasets.map((d) => d.label)];
  const rows = result.labels.map((label, i) =>
    [label, ...result.datasets.map((d) => String(d.data[i] || 0))].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Schedule a recurring report email.
 */
export async function scheduleReport(
  clientId: string,
  config: {
    name: string;
    filters: ReportFilter;
    groupBy: ReportGroupBy;
    frequency: "daily" | "weekly" | "monthly";
    recipients: string[];
  }
): Promise<void> {
  await prisma.scheduledReport.create({
    data: {
      clientId,
      name: config.name,
      filters: config.filters as any,
      groupBy: config.groupBy as any,
      frequency: config.frequency,
      recipients: config.recipients,
      nextRunAt: calculateNextRun(config.frequency),
    },
  });
}

function calculateNextRun(frequency: string): Date {
  const now = new Date();
  if (frequency === "daily") return new Date(now.getTime() + 86400000);
  if (frequency === "weekly") return new Date(now.getTime() + 7 * 86400000);
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

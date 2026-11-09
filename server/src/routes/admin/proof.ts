/**
 * V2 (T11) — admin cross-client proof + platform profitability.
 *
 * GET /admin/proof          → 8-week snapshot table across clients
 * GET /admin/proof/profit   → per-plan cost/margin view + cost-per-lead alert
 */
import { FastifyInstance, FastifyRequest } from "fastify";
import { computeProfitability } from "../../services/proof-metrics";
import { monthlyCharged } from "../../config/plans";
import { config } from "../../config";

const DAY = 24 * 60 * 60 * 1000;

export default async function adminProofRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  fastify.get("/admin/proof", async (request: FastifyRequest) => {
    const weeks = Math.min(24, Math.max(1, parseInt((request.query as Record<string, string>).weeks || "8") || 8));
    const since = new Date(Date.now() - weeks * 7 * DAY);

    const rows = await fastify.prisma.weeklyBrokerMetric.findMany({
      where: { weekStart: { gte: since } },
      orderBy: [{ weekStart: "desc" }, { leadsReceived: "desc" }],
      select: {
        clientId: true, weekStart: true, weekEnd: true, leadsReceived: true,
        medianFirstCallSeconds: true, reachRate: true, qualifiedRate: true,
        visitsBooked: true, visitsCompleted: true, costPerCompletedVisit: true,
        client: { select: { businessName: true, plan: true } },
      },
    });

    return { weeks, rows };
  });

  fastify.get("/admin/proof/profit", async () => {
    const since = new Date(Date.now() - 30 * DAY);

    const [clients, leads] = await Promise.all([
      fastify.prisma.client.findMany({
        where: { planStatus: { in: ["TRIAL", "ACTIVE"] } },
        select: { id: true, plan: true },
      }),
      fastify.prisma.lead.findMany({
        where: { receivedAt: { gte: since } },
        select: { clientId: true, platformCost: true, fairUseCappedAt: true },
      }),
    ]);

    const byPlan = new Map<string, { revenue: number; leadsHandled: number; fairUse: number; cost: number }>();
    const leadsByClient = new Map<string, { count: number; fairUse: number; cost: number }>();

    for (const lead of leads) {
      const bucket = leadsByClient.get(lead.clientId) ?? { count: 0, fairUse: 0, cost: 0 };
      bucket.count += 1;
      bucket.cost += lead.platformCost || 0;
      if (lead.fairUseCappedAt) bucket.fairUse += 1;
      leadsByClient.set(lead.clientId, bucket);
    }

    for (const client of clients) {
      const plan = client.plan === "LAUNCH" ? "STARTER" : client.plan;
      const charged = monthlyCharged(plan as "STARTER" | "GROWTH" | "PRO");
      const usage = leadsByClient.get(client.id) ?? { count: 0, fairUse: 0, cost: 0 };
      const bucket = byPlan.get(plan) ?? { revenue: 0, leadsHandled: 0, fairUse: 0, cost: 0 };
      bucket.revenue += charged;
      bucket.leadsHandled += usage.count;
      bucket.fairUse += usage.fairUse;
      bucket.cost += usage.cost;
      byPlan.set(plan, bucket);
    }

    const rows = computeProfitability(
      [...byPlan.entries()].map(([plan, v]) => ({
        plan,
        planRevenueInclGst: v.revenue,
        leadsHandled: v.leadsHandled,
        leadsFairUseCapped: v.fairUse,
        platformCost: Math.round(v.cost * 100) / 100,
      }))
    );

    const totalLeads = rows.reduce((s, r) => s + (r.avgPlatformCostPerLead > 0 ? 1 : 0), 0);
    const avgCostPerLead =
      totalLeads > 0
        ? Math.round(rows.reduce((s, r) => s + r.avgPlatformCostPerLead, 0) / totalLeads * 100) / 100
        : 0;
    const alert = avgCostPerLead > config.COST_PER_LEAD_ALERT_RUPEES;

    return {
      windowDays: 30,
      rows,
      avgPlatformCostPerLead: avgCostPerLead,
      costPerLeadAlertRupees: config.COST_PER_LEAD_ALERT_RUPEES,
      alert,
      message: alert
        ? `Average platform cost per lead (₹${avgCostPerLead}) is above the ₹${config.COST_PER_LEAD_ALERT_RUPEES} alert threshold.`
        : "Average platform cost per lead is within the alert threshold.",
    };
  });
}

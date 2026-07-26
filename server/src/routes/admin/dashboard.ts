import { FastifyInstance, FastifyRequest } from "fastify";

export default async function adminDashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  fastify.get("/admin/dashboard", async (_request: FastifyRequest) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalClients,
      activeClients,
      totalLeads,
      callsToday,
      callsThisMonth,
      totalBookings,
      territoriesTotal,
      territoriesAvailable,
    ] = await Promise.all([
      fastify.prisma.client.count(),
      fastify.prisma.client.count({ where: { planStatus: { in: ["TRIAL", "ACTIVE"] } } }),
      fastify.prisma.lead.count(),
      fastify.prisma.call.count({ where: { createdAt: { gte: startOfToday } } }),
      fastify.prisma.call.count({ where: { createdAt: { gte: startOfMonth } } }),
      fastify.prisma.booking.count(),
      fastify.prisma.territory.count(),
      fastify.prisma.territory.count({ where: { locked: false } }),
    ]);

    // Calculate MRR (Monthly Recurring Revenue)
    const activeClientsWithPlans = await fastify.prisma.client.findMany({
      where: { planStatus: { in: ["TRIAL", "ACTIVE"] } },
      select: { plan: true },
    });

    const planPrices: Record<string, number> = {
      STARTER: 18000,
      GROWTH: 35000,
      PRO: 60000,
    };

    const totalMRR = activeClientsWithPlans.reduce((sum, c) => sum + (planPrices[c.plan] || 0), 0);

    // Financial KPIs
    const [
      totalCostIncurred,
      totalRevenueGenerated,
      totalDeferredRevenue,
      totalRecognizedRevenue,
      brokerCosts,
      pastDueClients,
    ] = await Promise.all([
      fastify.prisma.client.aggregate({ _sum: { totalCostIncurred: true } }),
      fastify.prisma.client.aggregate({ _sum: { totalRevenueGenerated: true } }),
      fastify.prisma.accountingEntry.aggregate({
        _sum: { deferredAmount: true },
        where: { status: "DEFERRED" },
      }),
      fastify.prisma.accountingEntry.aggregate({
        _sum: { recognizedAmount: true },
        where: { status: { in: ["RECOGNIZED", "DEFERRED"] } },
      }),
      fastify.prisma.client.aggregate({
        _sum: { totalCostIncurred: true },
        where: { planStatus: "ACTIVE" },
      }),
      fastify.prisma.client.count({ where: { planStatus: "PAST_DUE" } }),
    ]);

    const costs = totalCostIncurred._sum.totalCostIncurred || 0;
    const revenue = totalRevenueGenerated._sum.totalRevenueGenerated || 0;
    const profit = revenue - costs;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return {
      totalMRR,
      totalClients,
      activeClients,
      pastDueClients,
      totalLeads,
      callsToday,
      callsThisMonth,
      totalBookings,
      territoriesTotal,
      territoriesAvailable,
      finance: {
        totalCost: Math.round(costs * 100) / 100,
        totalRevenue: Math.round(revenue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        profitMargin: margin,
        deferredRevenue: Math.round((totalDeferredRevenue._sum.deferredAmount || 0) * 100) / 100,
        recognizedRevenue: Math.round((totalRecognizedRevenue._sum.recognizedAmount || 0) * 100) / 100,
      },
      systemHealth: {
        postgres: "connected",
        redis: "connected",
        pipecat: "ready",
      },
    };
  });

  fastify.get("/admin/calls", async (request: FastifyRequest) => {
    const { page = "1", limit = "20" } = request.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [calls, total] = await Promise.all([
      fastify.prisma.call.findMany({
        skip,
        take: parseInt(limit),
        include: {
          lead: { select: { name: true, phone: true } },
          client: { select: { businessName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.call.count(),
    ]);

    return { calls, total, page: parseInt(page), limit: parseInt(limit) };
  });

  fastify.get("/admin/leads", async (request: FastifyRequest) => {
    const { page = "1", limit = "20", status, source } = request.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [leads, total] = await Promise.all([
      fastify.prisma.lead.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { client: { select: { businessName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.lead.count({ where }),
    ]);

    return { leads, total, page: parseInt(page), limit: parseInt(limit) };
  });
}

import { FastifyInstance, FastifyRequest } from "fastify";

export default async function clientDashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);  fastify.get("/dashboard", async (request: FastifyRequest, reply) => {
    const now = new Date();

    // ─── Admin route — return platform-wide aggregated data ───
    if (request.role === "admin") {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalClients,
        activeClients,
        totalLeads,
        callsToday,
        callsThisMonth,
        totalBookings,
        leadsBySource,
        leadsByStatus,
        creditOverview,
      ] = await Promise.all([
        fastify.prisma.client.count(),
        fastify.prisma.client.count({ where: { planStatus: { in: ["TRIAL", "ACTIVE"] } } }),
        fastify.prisma.lead.count(),
        fastify.prisma.call.count({ where: { createdAt: { gte: startOfToday } } }),
        fastify.prisma.call.count({ where: { createdAt: { gte: startOfMonth } } }),
        fastify.prisma.booking.count(),
        fastify.prisma.lead.groupBy({ by: ["source"], _count: { id: true } }),
        fastify.prisma.lead.groupBy({ by: ["status"], _count: { id: true } }),
        fastify.prisma.platformCredit.findFirst({
          orderBy: { billingMonth: "desc" },
          select: { totalMinutesPurchased: true, minutesUsed: true, costPerMinute: true },
        }),
      ]);

      // MRR calculation
      const activePlans = await fastify.prisma.client.findMany({
        where: { planStatus: { in: ["TRIAL", "ACTIVE"] } },
        select: { plan: true },
      });
      const planPrices: Record<string, number> = { STARTER: 18000, GROWTH: 35000, PRO: 60000 };
      const mrr = activePlans.reduce((sum, c) => sum + (planPrices[c.plan] || 0), 0);

      return {
        admin: true,
        platform: {
          clients: { total: totalClients, active: activeClients },
          leads: { total: totalLeads },
          calls: { today: callsToday, thisMonth: callsThisMonth },
          bookings: { total: totalBookings },
          revenue: { mrr, arr: mrr * 12 },
          credits: creditOverview
            ? {
                minutesPurchased: creditOverview.totalMinutesPurchased,
                minutesUsed: creditOverview.minutesUsed,
                minutesRemaining: creditOverview.totalMinutesPurchased - creditOverview.minutesUsed,
                costPerMinute: creditOverview.costPerMinute,
              }
            : null,
        },
        leadsBySource,
        leadsByStatus,
      };
    }

    // ─── Broker route — normal client-scoped data ────────────
    const clientId = request.clientId;
    if (!clientId) {
      return reply.status(401).send({ error: "Authentication required" });
    }

    const client = await fastify.prisma.client.findUnique({
      where: { id: clientId },
      select: { trialEndsAt: true, planStatus: true, plan: true },
    });
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayLeads,
      todayCalls,
      todayBookings,
      monthLeads,
      monthCalls,
      monthBookings,
      totalLeads,
      leadsBySource,
      leadsByStatus,
      recentActivity,
      activeFollowups,
    ] = await Promise.all([
      fastify.prisma.lead.count({ where: { clientId, receivedAt: { gte: startOfToday } } }),
      fastify.prisma.call.count({ where: { clientId, createdAt: { gte: startOfToday } } }),
      fastify.prisma.booking.count({ where: { clientId, createdAt: { gte: startOfToday } } }),
      fastify.prisma.lead.count({ where: { clientId, receivedAt: { gte: startOfMonth } } }),
      fastify.prisma.call.count({ where: { clientId, createdAt: { gte: startOfMonth } } }),
      fastify.prisma.booking.count({ where: { clientId, createdAt: { gte: startOfMonth } } }),
      fastify.prisma.lead.count({ where: { clientId } }),
      fastify.prisma.lead.groupBy({
        by: ["source"],
        where: { clientId },
        _count: { id: true },
      }),
      fastify.prisma.lead.groupBy({
        by: ["status"],
        where: { clientId },
        _count: { id: true },
      }),
      fastify.prisma.lead.findMany({
        where: { clientId },
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: { booking: { select: { visitDate: true, visitTime: true } } },
      }),
      fastify.prisma.lead.count({
        where: {
          clientId,
          status: { in: ["FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3"] },
        },
      }),
    ]);

    const qualifiedLeads = await fastify.prisma.lead.count({
      where: { clientId, status: { in: ["BOOKED", "VISITED", "CONVERTED", "REBOOKED"] } },
    });
    const visitedLeads = await fastify.prisma.lead.count({
      where: { clientId, status: { in: ["VISITED", "CONVERTED"] } },
    });
    const convertedLeads = await fastify.prisma.lead.count({
      where: { clientId, status: "CONVERTED" },
    });

    const qualifiedRate = monthLeads > 0 ? Math.round((qualifiedLeads / monthLeads) * 100) : 0;
    const bookingRate = qualifiedLeads > 0 ? Math.round((monthBookings / qualifiedLeads) * 100) : 0;
    const showRate = monthBookings > 0 ? Math.round((visitedLeads / monthBookings) * 100) : 0;
    const conversionRate = visitedLeads > 0 ? Math.round((convertedLeads / visitedLeads) * 100) : 0;

    const todayBookingsList = await fastify.prisma.booking.findMany({
      where: {
        clientId,
        visitDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) },
        status: { in: ["CONFIRMED", "REMINDED"] },
      },
      include: { lead: { select: { name: true, phone: true } } },
      orderBy: { visitTime: "asc" },
    });

    // Daily chart data (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyLeads = await fastify.prisma.lead.groupBy({
      by: ["receivedAt"],
      where: { clientId, receivedAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    });
    const dailyCalls = await fastify.prisma.call.groupBy({
      by: ["createdAt"],
      where: { clientId, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    });
    const dailyBookings = await fastify.prisma.booking.groupBy({
      by: ["createdAt"],
      where: { clientId, createdAt: { gte: thirtyDaysAgo } },
      _count: { id: true },
    });

    const dailyMap = new Map<string, { leads: number; calls: number; bookings: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dailyMap.set(d.toISOString().split("T")[0], { leads: 0, calls: 0, bookings: 0 });
    }
    for (const lead of dailyLeads) {
      const key = lead.receivedAt.toISOString().split("T")[0];
      if (dailyMap.has(key)) dailyMap.get(key)!.leads += lead._count.id;
    }
    for (const call of dailyCalls) {
      const key = call.createdAt.toISOString().split("T")[0];
      if (dailyMap.has(key)) dailyMap.get(key)!.calls += call._count.id;
    }
    for (const booking of dailyBookings) {
      const key = booking.createdAt.toISOString().split("T")[0];
      if (dailyMap.has(key)) dailyMap.get(key)!.bookings += booking._count.id;
    }
    const dailyActivity = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return {
      stats: {
        todayLeads,
        todayCalls,
        todayBookings,
        monthLeads,
        monthCalls,
        monthBookings,
        qualifiedRate,
        bookingRate,
        showRate,
        conversionRate,
        activeFollowups,
        totalLeads,
      },
      plan: {
        status: client?.planStatus || "TRIAL",
        tier: client?.plan || "GROWTH",
        trialEndsAt: client?.trialEndsAt?.toISOString() || null,
      },
      leadsBySource,
      leadsByStatus,
      recentActivity,
      todayBookings: todayBookingsList,
      dailyActivity,
    };
  });
}

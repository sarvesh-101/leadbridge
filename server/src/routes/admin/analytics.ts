/**
 * Admin Analytics Routes
 *
 * Full platform analytics and monitoring — ported from FastAPI Python backend.
 * Provides super admin with system-wide metrics, growth trends, and health checks.
 */
import { FastifyInstance, FastifyRequest } from "fastify";

export default async function adminAnalyticsRoutes(fastify: FastifyInstance) {
  // All routes require admin auth
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── Platform Dashboard Analytics ──────────────────────────────
  fastify.get("/admin/analytics/dashboard", async (_request: FastifyRequest) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTenants,
      activeTenants,
      trialTenants,
      totalLeads,
      leadsToday,
      leadsMonth,
      totalCalls,
      callsToday,
      callsMonth,
      totalBookings,
      totalConverted,
      territoryTotal,
      territoryOccupied,
      newTenantsMonth,
    ] = await Promise.all([
      fastify.prisma.client.count(),
      fastify.prisma.client.count({ where: { planStatus: { in: ["TRIAL", "ACTIVE"] } } }),
      fastify.prisma.client.count({ where: { planStatus: "TRIAL" } }),
      fastify.prisma.lead.count(),
      fastify.prisma.lead.count({ where: { createdAt: { gte: todayStart } } }),
      fastify.prisma.lead.count({ where: { createdAt: { gte: monthStart } } }),
      fastify.prisma.call.count(),
      fastify.prisma.call.count({ where: { createdAt: { gte: todayStart } } }),
      fastify.prisma.call.count({ where: { createdAt: { gte: monthStart } } }),
      fastify.prisma.booking.count(),
      fastify.prisma.lead.count({ where: { status: "CONVERTED" } }),
      fastify.prisma.territory.count(),
      fastify.prisma.territory.count({ where: { locked: true } }),
      fastify.prisma.client.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    // Calculate MRR from active client plans — uses groupBy for efficiency
    const planPrices: Record<string, number> = {
      STARTER: 18000,
      GROWTH: 35000,
      PRO: 60000,
    };

    const planCounts = await fastify.prisma.client.groupBy({
      by: ["plan"],
      where: { planStatus: { in: ["TRIAL", "ACTIVE"] } },
      _count: { plan: true },
    });

    const mrr = planCounts.reduce((sum, g) => sum + (planPrices[g.plan] || 0) * g._count.plan, 0);

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        trial: trialTenants,
        newThisMonth: newTenantsMonth,
      },
      leads: {
        total: totalLeads,
        today: leadsToday,
        thisMonth: leadsMonth,
        converted: totalConverted,
        conversionRate: totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0,
      },
      calls: {
        total: totalCalls,
        today: callsToday,
        thisMonth: callsMonth,
      },
      appointments: {
        total: totalBookings,
      },
      revenue: {
        mrr,
        arr: mrr * 12,
      },
      territories: {
        total: territoryTotal,
        occupied: territoryOccupied,
        available: territoryTotal - territoryOccupied,
      },
    };
  });

  // ─── Daily Growth Metrics ──────────────────────────────────────
  fastify.get("/admin/analytics/growth", async (request: FastifyRequest) => {
    const { days = "30" } = request.query as Record<string, string>;
    const periodDays = Math.max(7, Math.min(365, parseInt(days) || 30));
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // We can't easily do date_trunc with Prisma without raw queries.
    // Instead, return aggregate counts for the period.
    const [
      newClients,
      newLeads,
      newCalls,
    ] = await Promise.all([
      fastify.prisma.client.count({ where: { createdAt: { gte: since } } }),
      fastify.prisma.lead.count({ where: { createdAt: { gte: since } } }),
      fastify.prisma.call.count({ where: { createdAt: { gte: since } } }),
    ]);

    return {
      periodDays: parseInt(days),
      since: since.toISOString(),
      totals: {
        newClients,
        newLeads,
        newCalls,
      },
    };
  });

  // ─── System Health ─────────────────────────────────────────────
  fastify.get("/admin/system/health", async (_request: FastifyRequest) => {
    // Prisma connection check
    let postgresStatus = "healthy";
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
    } catch {
      postgresStatus = "unhealthy";
    }

    // Redis check
    let redisStatus = "healthy";
    try {
      const redis = fastify.redis;
      if (redis) {
        await redis.ping();
      }
    } catch {
      redisStatus = "unhealthy";
    }

    return {
      status: postgresStatus === "healthy" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      checks: {
        postgres: postgresStatus,
        redis: redisStatus,
      },
    };
  });

  // ─── System Usage Stats ────────────────────────────────────────
  fastify.get("/admin/system/usage", async (_request: FastifyRequest) => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsersToday] = await Promise.all([
      fastify.prisma.client.count(),
      fastify.prisma.client.count({ where: { updatedAt: { gte: yesterday } } }),
    ]);

    return {
      totalUsers,
      activeUsersToday,
      engagementRate: totalUsers > 0 ? Math.round((activeUsersToday / totalUsers) * 100) : 0,
    };
  });

  // ─── Forwarding Analytics ──────────────────────────────────────
  fastify.get("/admin/forwarding/analytics", async (_request: FastifyRequest) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sources that indicate forwarding
    const forwardSources = ["sms_forward", "email_forward", "test_forward"];

    // Total forwarded leads
    const totalForwarded = await fastify.prisma.lead.count({
      where: { source: { in: forwardSources } },
    });

    // Forwarded leads breakdown by source
    const forwardBySource = await fastify.prisma.lead.groupBy({
      by: ["source"],
      where: { source: { in: forwardSources } },
      _count: { id: true },
    });

    // Forwarded leads breakdown by portalSource
    const forwardByPortal = await fastify.prisma.lead.groupBy({
      by: ["portalSource"],
      where: {
        source: { in: forwardSources },
        portalSource: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Forwarded leads today
    const forwardedToday = await fastify.prisma.lead.count({
      where: {
        source: { in: forwardSources },
        createdAt: { gte: todayStart },
      },
    });

    // Forwarded leads this month
    const forwardedThisMonth = await fastify.prisma.lead.count({
      where: {
        source: { in: forwardSources },
        createdAt: { gte: monthStart },
      },
    });

    // Conversion stats for forwarded leads
    const forwardedConverted = await fastify.prisma.lead.count({
      where: {
        source: { in: forwardSources },
        status: "CONVERTED",
      },
    });

    const forwardedBooked = await fastify.prisma.lead.count({
      where: {
        source: { in: forwardSources },
        status: { in: ["BOOKED", "VISITED", "CONVERTED"] },
      },
    });

    const forwardedCalled = await fastify.prisma.lead.count({
      where: {
        source: { in: forwardSources },
        firstCalledAt: { not: null },
      },
    });

    // Recent forwarded leads with broker info
    const recentLeads = await fastify.prisma.lead.findMany({
      where: { source: { in: forwardSources } },
      include: {
        client: { select: { businessName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Status breakdown for funnel
    const statusBreakdown = await fastify.prisma.lead.groupBy({
      by: ["status"],
      where: { source: { in: forwardSources } },
      _count: { id: true },
    });

    return {
      summary: {
        totalForwarded,
        forwardedToday,
        forwardedThisMonth,
        forwardedConverted,
        forwardedBooked,
        forwardedCalled,
        conversionRate: totalForwarded > 0
          ? Math.round((forwardedConverted / totalForwarded) * 100)
          : 0,
        bookingRate: totalForwarded > 0
          ? Math.round((forwardedBooked / totalForwarded) * 100)
          : 0,
      },
      // Merge groupBy results: source breakdown counts
      bySource: forwardBySource.reduce((acc, item) => {
        acc[item.source] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      byPortal: forwardByPortal.map(item => ({
        portal: item.portalSource || "unknown",
        count: item._count.id,
      })),
      statusFunnel: statusBreakdown.map(item => ({
        status: item.status,
        count: item._count.id,
      })),
      recentLeads: recentLeads.map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        source: lead.source,
        portalSource: lead.portalSource,
        status: lead.status,
        createdAt: lead.createdAt.toISOString(),
        broker: lead.client.businessName,
      })),
    };
  });
}

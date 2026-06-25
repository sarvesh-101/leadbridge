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
      STARTER: 1999,
      GROWTH: 4999,
      PRO: 9999,
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
}

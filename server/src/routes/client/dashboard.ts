import { FastifyInstance, FastifyRequest } from "fastify";

export default async function clientDashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/dashboard", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const now = new Date();
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

    // Calculate rates
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

    // Today's upcoming bookings
    const todayBookingsList = await fastify.prisma.booking.findMany({
      where: {
        clientId,
        visitDate: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) },
        status: { in: ["CONFIRMED", "REMINDED"] },
      },
      include: { lead: { select: { name: true, phone: true } } },
      orderBy: { visitTime: "asc" },
    });

    // ─── Real Daily Chart Data (last 30 days) ────────────────
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get daily lead counts
    const dailyLeads = await fastify.prisma.lead.groupBy({
      by: ["receivedAt"],
      where: {
        clientId,
        receivedAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });

    // Get daily call counts
    const dailyCalls = await fastify.prisma.call.groupBy({
      by: ["createdAt"],
      where: {
        clientId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });

    // Get daily booking counts
    const dailyBookings = await fastify.prisma.booking.groupBy({
      by: ["createdAt"],
      where: {
        clientId,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });

    // Build a map of date -> counts for the last 30 days
    const dailyMap = new Map<string, { leads: number; calls: number; bookings: number }>();

    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0]; // YYYY-MM-DD
      dailyMap.set(key, { leads: 0, calls: 0, bookings: 0 });
    }

    // Fill in actual counts
    for (const lead of dailyLeads) {
      const key = lead.receivedAt.toISOString().split("T")[0];
      if (dailyMap.has(key)) {
        dailyMap.get(key)!.leads += lead._count.id;
      }
    }
    for (const call of dailyCalls) {
      const key = call.createdAt.toISOString().split("T")[0];
      if (dailyMap.has(key)) {
        dailyMap.get(key)!.calls += call._count.id;
      }
    }
    for (const booking of dailyBookings) {
      const key = booking.createdAt.toISOString().split("T")[0];
      if (dailyMap.has(key)) {
        dailyMap.get(key)!.bookings += booking._count.id;
      }
    }

    // Sort by date ascending
    const dailyActivity = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date,
        ...counts,
      }));

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
      leadsBySource,
      leadsByStatus,
      recentActivity,
      todayBookings: todayBookingsList,
      dailyActivity,
    };
  });
}

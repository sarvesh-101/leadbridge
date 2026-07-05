/**
 * Admin Territory Performance Comparison Routes.
 * GET /admin/territories/comparison — Compare broker performance across territories
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function territoryComparisonRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  /**
   * Get territory performance comparison for admin.
   */
  fastify.get("/admin/territories/comparison", async (request: FastifyRequest) => {
    // Get all clients grouped by city/territory
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        businessName: true,
        city: true,
        zone: true,
        planStatus: true,
        callsThisMonth: true,
        _count: {
          select: {
            leads: true,
            calls: true,
            bookings: true,
          },
        },
      },
    });

    // Count conversions per client
    const clientIds = clients.map((c) => c.id);
    const conversionCounts = await prisma.lead.groupBy({
      by: ["clientId"],
      where: { clientId: { in: clientIds }, status: "CONVERTED" },
      _count: { id: true },
    });

    const conversionMap: Record<string, number> = {};
    for (const c of conversionCounts) {
      conversionMap[c.clientId] = c._count.id;
    }

    // Group by city
    const cities: Record<
      string,
      {
        totalClients: number;
        totalLeads: number;
        totalCalls: number;
        totalBookings: number;
        totalConversions: number;
        avgMonthlyCalls: number;
        avgConversionRate: number;
        brokers: Array<{
          id: string;
          name: string;
          leads: number;
          calls: number;
          bookings: number;
          conversions: number;
          conversionRate: number;
          planStatus: string;
        }>;
      }
    > = {};

    for (const client of clients) {
      const city = client.city || "Unknown";
      if (!cities[city]) {
        cities[city] = {
          totalClients: 0,
          totalLeads: 0,
          totalCalls: 0,
          totalBookings: 0,
          totalConversions: 0,
          avgMonthlyCalls: 0,
          avgConversionRate: 0,
          brokers: [],
        };
      }

      const conversions = conversionMap[client.id] || 0;
      const totalLeads = client._count.leads;

      cities[city].totalClients++;
      cities[city].totalLeads += totalLeads;
      cities[city].totalCalls += client._count.calls;
      cities[city].totalBookings += client._count.bookings;
      cities[city].totalConversions += conversions;

      cities[city].brokers.push({
        id: client.id,
        name: client.businessName,
        leads: totalLeads,
        calls: client._count.calls,
        bookings: client._count.bookings,
        conversions,
        conversionRate: totalLeads > 0 ? Math.round((conversions / totalLeads) * 100) : 0,
        planStatus: client.planStatus,
      });
    }

    // Calculate averages for each city
    for (const city of Object.keys(cities)) {
      const c = cities[city];
      c.avgMonthlyCalls = c.totalClients > 0 ? Math.round(c.totalCalls / c.totalClients) : 0;
      c.avgConversionRate =
        c.totalLeads > 0 ? Math.round((c.totalConversions / c.totalLeads) * 100) : 0;
    }

    // Sort cities by total conversions
    const sortedCities = Object.entries(cities)
      .map(([city, data]) => ({ city, ...data }))
      .sort((a, b) => b.totalConversions - a.totalConversions);

    return {
      success: true,
      territories: sortedCities,
      summary: {
        totalCities: sortedCities.length,
        totalBrokers: clients.length,
        topCity: sortedCities[0]?.city || "—",
      },
    };
  });
}

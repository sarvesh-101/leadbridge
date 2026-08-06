import { FastifyInstance } from "fastify";

/**
 * Public (no-auth) endpoints for the marketing landing page.
 *
 * Returns REAL aggregate data from the database so the landing page
 * never has to fake numbers again. Privacy-safe: only counts and
 * city/zone names are exposed — never broker names or lead data.
 */
export default async function publicRoutes(fastify: FastifyInstance) {
  // GET /public/landing — real stats for the landing page
  // Slow-changing public data → cache for 60s to reduce DB pressure.
  fastify.get("/public/landing", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=60");

    const [territories, brokerCount, callCount, bookingCount] = await Promise.all([
      fastify.prisma.territory.findMany({
        select: { city: true, zone: true, clientId: true },
        orderBy: [{ city: "asc" }],
      }),
      fastify.prisma.client.count(),
      fastify.prisma.call.count(),
      fastify.prisma.booking.count(),
    ]);

    const claimed = territories.filter((t) => t.clientId);

    return {
      territories: territories.map((t) => ({
        city: t.city,
        zone: t.zone,
        status: t.clientId ? ("taken" as const) : ("available" as const),
      })),
      stats: {
        activeBrokers: brokerCount,
        callsMade: callCount,
        visitsBooked: bookingCount,
        citiesClaimed: claimed.length,
        citiesAvailable: territories.length - claimed.length,
        totalCitiesTracked: territories.length,
      },
      fetchedAt: new Date().toISOString(),
    };
  });
}

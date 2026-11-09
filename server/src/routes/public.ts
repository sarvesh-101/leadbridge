import { FastifyInstance } from "fastify";
import { buildPlansPayload } from "../config/plans";
import { buildIntegrationsPayload } from "../config/integration-status";

/**
 * Public (no-auth) endpoints for the marketing landing page.
 *
 * Returns REAL aggregate data from the database so the landing page
 * never has to fake numbers again. Privacy-safe: only counts and
 * city/zone names are exposed — never broker names or lead data.
 */
export default async function publicRoutes(fastify: FastifyInstance) {
  // GET /public/plans — the single-source plans payload for the website.
  // One place to change prices (config/plans.ts) → server, invoices AND the
  // marketing site all follow. Static data → cache longer than /public/landing.
  fastify.get("/public/plans", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return buildPlansPayload();
  });

  // GET /public/integrations — the single-source lead-source status table
  // (V2 T8). The website, the prompt and the admin guide all read this config.
  fastify.get("/public/integrations", {
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return buildIntegrationsPayload();
  });

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

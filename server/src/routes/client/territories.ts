/**
 * Client Territory Routes — ported from FastAPI Python backend.
 *
 * Allows clients to browse available territories and claim one.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { assignTerritory } from "../../services/territory.service";

export default async function clientTerritoryRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Territories ─────────────────────────────────────────
  // Ported from FastAPI: GET /territories/
  fastify.get("/territories", async (request: FastifyRequest) => {
    const { status, city, state, tier, search } = request.query as Record<string, string>;

    const where: Record<string, unknown> = {};

    if (status === "available") where.clientId = null;
    if (status === "occupied") where.clientId = { not: null };
    if (city) where.city = { contains: city, mode: "insensitive" };
    if (tier) where.tier = parseInt(tier);
    if (search) {
      where.OR = [
        { city: { contains: search, mode: "insensitive" } },
        { zone: { contains: search, mode: "insensitive" } },
      ];
    }

    const territories = await fastify.prisma.territory.findMany({
      where,
      include: {
        client: { select: { businessName: true } },
      },
      orderBy: [{ tier: "asc" }, { city: "asc" }],
    });

    const items = territories.map((t) => ({
      id: t.id,
      city: t.city,
      zone: t.zone,
      tier: t.tier,
      locked: t.locked,
      isAvailable: !t.clientId && !t.locked,
      occupantName: t.client?.businessName || null,
    }));

    return { items, total: items.length };
  });

  // ─── List Available Territories ────────────────────────────────
  // Ported from FastAPI: GET /territories/available
  fastify.get("/territories/available", async () => {
    const territories = await fastify.prisma.territory.findMany({
      where: { clientId: null, locked: false },
      orderBy: [{ tier: "asc" }, { city: "asc" }],
    });

    return {
      territories: territories.map((t) => ({
        id: t.id,
        city: t.city,
        zone: t.zone,
        tier: t.tier,
        tierLabel: tierLabel(t.tier),
      })),
    };
  });

  // ─── Get My Territory / Service Area ─────────────────────────
  // Ported from FastAPI: GET /territories/my
  // Soft model: client.city/zone is the broker's service area. The linked
  // Territory row may be null (another broker holds the catalog row) — the
  // service area tag still works for scoring + analytics.
  fastify.get("/territories/my", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      include: { territory: true },
    });

    if (!client) {
      return { territory: null };
    }

    if (!client.city) {
      return { territory: null };
    }

    return {
      territory: {
        id: client.territory?.id || null,
        city: client.city,
        zone: client.zone,
        tier: client.territory?.tier || null,
        tierLabel: client.territory?.tier ? tierLabel(client.territory.tier) : null,
        locked: client.territory?.locked ?? false,
        exclusive: !!client.territory, // true only if the catalog row is linked
      },
    };
  });

  // ─── Claim Territory / Service Area (by city/zone — used by onboarding) ──
  // POST /territories/claim — soft model: ALWAYS succeeds. Sets the broker's
  // service area (client.city/zone). Never returns 409 for "taken" — leads are
  // broker-sourced, so multiple brokers can serve the same city.
  fastify.post("/territories/claim", {
    schema: {
      body: {
        type: "object",
        required: ["city"],
        properties: {
          city: { type: "string" },
          zone: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { city: string; zone?: string };
  }>, reply: FastifyReply) => {
    // Soft model: service area tag is available to all plans — no gate.
    const { city, zone } = request.body;

    if (!city || !city.trim()) {
      return reply.status(400).send({ error: "City is required" });
    }

    // Soft model: no hard "release first" rule — a broker can set/change their
    // service area at any time. Assignment never 409s; links catalog row only
    // if free.
    const result = await assignTerritory(fastify.prisma, request.clientId!, city, zone);

    return {
      message: `Service area set to '${city}${zone ? ` - ${zone}` : ""}'`,
      territory: result.territory
        ? {
            id: result.territory.id,
            city: result.territory.city,
            zone: result.territory.zone,
            tier: result.territory.tier,
          }
        : null,
      exclusive: !!result.territory,
    };
  });

  // ─── Purchase / Claim Territory (by territoryId) ────────────────
  // Ported from FastAPI: POST /territories/purchase
  // Soft model: setting a service area is open to all plans; the "purchase"
  // route is kept for backward compatibility and now behaves like claim — it
  // sets the broker's service area and links the catalog row only if free.
  fastify.post("/territories/purchase", {
    schema: {
      body: {
        type: "object",
        required: ["territoryId"],
        properties: {
          territoryId: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { territoryId: string };
  }>, reply: FastifyReply) => {
    const { territoryId } = request.body;

    const territory = await fastify.prisma.territory.findUnique({
      where: { id: territoryId },
    });

    if (!territory) {
      return reply.status(404).send({ error: "Territory not found" });
    }

    // Soft assignment — never 409 for occupied/locked; sets service area tag.
    const result = await assignTerritory(fastify.prisma, request.clientId!, territory.city, territory.zone || undefined);

    return {
      message: `Service area set to '${territory.city}${territory.zone ? ` - ${territory.zone}` : ""}'`,
      territory: result.territory
        ? {
            id: result.territory.id,
            city: result.territory.city,
            zone: result.territory.zone,
            tier: result.territory.tier,
          }
        : null,
      exclusive: !!result.territory,
    };
  });

  // ─── Release My Territory / Service Area ──────────────────────
  // Soft model: releases the linked catalog row (if any) AND clears the
  // broker's service area tag (client.city/zone). Works even when the broker
  // has a service area without a linked row (their target row is owned by
  // someone else).
  fastify.post("/territories/release", async (request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      include: { territory: true },
    });

    if (!client || (!client.territory && !client.city)) {
      return reply.status(400).send({ error: "You don't have a territory or service area to release" });
    }

    const { releaseTerritory } = await import("../../services/territory.service");
    await releaseTerritory(fastify.prisma, request.clientId!);

    return {
      message: "Service area released",
    };
  });
}


function tierLabel(tier: number): string {
  switch (tier) {
    case 1: return "Metro";
    case 2: return "Tier 2 City";
    case 3: return "Tier 3 City";
    default: return `Tier ${tier}`;
  }
}

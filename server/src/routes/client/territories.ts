/**
 * Client Territory Routes — ported from FastAPI Python backend.
 *
 * Allows clients to browse available territories and claim one.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

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

  // ─── Get My Territory ─────────────────────────────────────────
  // Ported from FastAPI: GET /territories/my
  fastify.get("/territories/my", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      include: { territory: true },
    });

    if (!client?.territory) {
      return { territory: null };
    }

    return {
      territory: {
        id: client.territory.id,
        city: client.territory.city,
        zone: client.territory.zone,
        tier: client.territory.tier,
        tierLabel: tierLabel(client.territory.tier),
        locked: client.territory.locked,
        assignedAt: client.territory.clientId ? undefined : undefined,
      },
    };
  });

  // ─── Purchase / Claim Territory ────────────────────────────────
  // Ported from FastAPI: POST /territories/purchase
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

    if (territory.clientId) {
      return reply.status(409).send({ error: "Territory is already occupied" });
    }

    if (territory.locked) {
      return reply.status(409).send({ error: "Territory is locked" });
    }

    // Check if client already has a territory
    const existing = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { territory: { select: { id: true } } },
    });

    if (existing?.territory) {
      return reply.status(409).send({
        error: "You already have a territory assigned. Release it first to claim a new one.",
      });
    }

    // Assign territory to client
    const [updatedTerritory] = await fastify.prisma.$transaction([
      fastify.prisma.territory.update({
        where: { id: territory.id },
        data: { clientId: request.clientId, locked: true },
      }),
      fastify.prisma.client.update({
        where: { id: request.clientId },
        data: { city: territory.city, zone: territory.zone },
      }),
    ]);

    return {
      message: `Territory '${updatedTerritory.city}${updatedTerritory.zone ? ` - ${updatedTerritory.zone}` : ""}' claimed`,
      territory: {
        id: updatedTerritory.id,
        city: updatedTerritory.city,
        zone: updatedTerritory.zone,
        tier: updatedTerritory.tier,
      },
    };
  });

  // ─── Release My Territory ─────────────────────────────────────
  fastify.post("/territories/release", async (request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      include: { territory: true },
    });

    if (!client?.territory) {
      return reply.status(400).send({ error: "You don't have a territory to release" });
    }

    await fastify.prisma.$transaction([
      fastify.prisma.territory.update({
        where: { id: client.territory.id },
        data: { clientId: null, locked: false },
      }),
      fastify.prisma.client.update({
        where: { id: client.id },
        data: { city: "", zone: null },
      }),
    ]);

    return {
      message: `Territory '${client.territory.city}${client.territory.zone ? ` - ${client.territory.zone}` : ""}' released`,
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

/**
 * Admin Territory Management Routes — ported from FastAPI Python backend.
 *
 * Super admin endpoints for territory lifecycle: create, update, force-release.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";

export default async function adminTerritoryRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── List Territories (admin) ──────────────────────────────────
  fastify.get("/admin/territories", async (request: FastifyRequest) => {
    const { search, tier, status } = request.query as Record<string, string>;

    const where: Record<string, unknown> = {};

    if (tier) where.tier = parseInt(tier);
    if (status === "occupied") where.clientId = { not: null };
    if (status === "available") where.clientId = null;
    if (status === "locked") where.locked = true;

    if (search) {
      where.OR = [
        { city: { contains: search, mode: "insensitive" } },
        { zone: { contains: search, mode: "insensitive" } },
      ];
    }

    const territories = await fastify.prisma.territory.findMany({
      where,
      include: {
        client: { select: { businessName: true, ownerName: true } },
      },
      orderBy: [{ tier: "asc" }, { city: "asc" }],
    });

    const items = territories.map((t) => ({
      id: t.id,
      city: t.city,
      zone: t.zone,
      tier: t.tier,
      locked: t.locked,
      clientId: t.clientId,
      client: t.client,
    }));

    return { items, total: items.length };
  });

  // ─── Create Territory ──────────────────────────────────────────
  // Ported from FastAPI: POST /admin/territories
  fastify.post("/admin/territories", {
    schema: {
      body: {
        type: "object",
        required: ["city", "tier"],
        properties: {
          city: { type: "string" },
          zone: { type: "string" },
          tier: { type: "integer", minimum: 1, maximum: 3 },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { city: string; zone?: string; tier: number };
  }>, reply: FastifyReply) => {
    const { city, zone, tier } = request.body;

    if (tier < 1 || tier > 3) {
      return reply.status(400).send({ error: "Tier must be 1, 2, or 3" });
    }

    // Check for duplicate
    const existing = await fastify.prisma.territory.findFirst({
      where: { city, zone: zone || null },
    });

    if (existing) {
      return reply.status(409).send({
        error: `Territory '${city}${zone ? ` - ${zone}` : ""}' already exists`,
      });
    }

    const territory = await fastify.prisma.territory.create({
      data: { city, zone: zone || null, tier },
    });

    return reply.status(201).send({
      message: `Territory '${territory.city}${territory.zone ? ` - ${territory.zone}` : ""}' created`,
      id: territory.id,
      city: territory.city,
      zone: territory.zone,
      tier: territory.tier,
    });
  });

  // ─── Update Territory ──────────────────────────────────────────
  // Ported from FastAPI: PATCH /admin/territories/{territory_id}
  fastify.patch("/admin/territories/:id", async (
    request: FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> }>, reply: FastifyReply
  ) => {
    const territory = await fastify.prisma.territory.findUnique({
      where: { id: request.params.id },
    });

    if (!territory) {
      return reply.status(404).send({ error: "Territory not found" });
    }

    const updatable = ["city", "zone", "tier", "locked"];
    const data = Object.fromEntries(
      updatable.filter((k) => k in request.body).map((k) => [k, request.body[k]])
    );

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    // Validate tier if updating
    const tierValue = data.tier as number | undefined;
    if (tierValue !== undefined && (tierValue < 1 || tierValue > 3)) {
      return reply.status(400).send({ error: "Tier must be 1, 2, or 3" });
    }

    const updated = await fastify.prisma.territory.update({
      where: { id: territory.id },
      data: data as any,
    });

    return {
      message: `Territory '${updated.city}${updated.zone ? ` - ${updated.zone}` : ""}' updated`,
      id: updated.id,
      city: updated.city,
      zone: updated.zone,
      tier: updated.tier,
      locked: updated.locked,
    };
  });

  // ─── Assign Territory to Client ─────────────────────────────────
  // POST /admin/territories/assign — manually assign a territory to a client
  fastify.post("/admin/territories/assign", {
    schema: {
      body: {
        type: "object",
        required: ["clientId", "city"],
        properties: {
          clientId: { type: "string" },
          city: { type: "string" },
          zone: { type: "string" },
          tier: { type: "integer", minimum: 1, maximum: 3 },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { clientId: string; city: string; zone?: string; tier?: number };
  }>, reply: FastifyReply) => {
    const { clientId, city, zone, tier } = request.body;

    // Check client exists
    const client = await fastify.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // Check if client already has a territory
    if (client.city) {
      return reply.status(409).send({
        error: `Client '${client.businessName}' already has territory '${client.city}${client.zone ? ` - ${client.zone}` : ""}'. Release it first.`,
      });
    }

    // Find or create the territory
    let territory = await fastify.prisma.territory.findFirst({
      where: { city, zone: zone || null },
    });

    if (territory) {
      if (territory.clientId && territory.clientId !== clientId) {
        return reply.status(409).send({
          error: `Territory '${city}${zone ? ` - ${zone}` : ""}' is already assigned to another client`,
        });
      }
      if (territory.locked) {
        return reply.status(409).send({ error: "Territory is locked" });
      }
    } else {
      // Create the territory if it doesn't exist
      territory = await fastify.prisma.territory.create({
        data: { city, zone: zone || null, tier: tier || 2 },
      });
    }

    // Assign territory to client
    await fastify.prisma.$transaction([
      fastify.prisma.territory.update({
        where: { id: territory.id },
        data: { clientId, locked: true },
      }),
      fastify.prisma.client.update({
        where: { id: clientId },
        data: { city, zone: zone || null },
      }),
    ]);

    return {
      message: `Territory '${city}${zone ? ` - ${zone}` : ""}' assigned to ${client.businessName}`,
      territory: { id: territory.id, city, zone, tier: territory.tier },
      client: { id: clientId, businessName: client.businessName },
    };
  });

  // ─── Release Territory (force-release from client) ──────────────
  // Ported from FastAPI: POST /admin/territories/{territory_id}/release
  fastify.post("/admin/territories/:id/release", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const territory = await fastify.prisma.territory.findUnique({
      where: { id: request.params.id },
      include: { client: { select: { id: true, businessName: true } } },
    });

    if (!territory) {
      return reply.status(404).send({ error: "Territory not found" });
    }

    if (!territory.clientId) {
      return reply.status(400).send({ error: "Territory is not currently occupied" });
    }

    const previousClient = territory.client;

    // Release territory and clear client's city/zone in a transaction
    await fastify.prisma.$transaction([
      fastify.prisma.territory.update({
        where: { id: territory.id },
        data: { clientId: null, locked: false },
      }),
      fastify.prisma.client.update({
        where: { id: territory.clientId },
        data: { city: "", zone: null },
      }),
    ]);

    return {
      message: `Territory '${territory.city}${territory.zone ? ` - ${territory.zone}` : ""}' released`,
      previousClient: previousClient
        ? { id: previousClient.id, businessName: previousClient.businessName }
        : null,
    };
  });
}

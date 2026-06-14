import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { assignTerritory } from "../../services/territory.service";
import { generateCallScript } from "../../services/deepseek.service";

export default async function adminClientRoutes(fastify: FastifyInstance) {
  // All routes require admin auth
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── List Clients ─────────────────────────────────────────────
  fastify.get("/admin/clients", async (request: FastifyRequest, reply: FastifyReply) => {
    const { search, page = "1", limit = "20" } = request.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { ownerName: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [clients, total] = await Promise.all([
      fastify.prisma.client.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          territory: true,
          _count: { select: { leads: true, calls: true, bookings: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.client.count({ where }),
    ]);

    return { clients, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── Create Client ────────────────────────────────────────────
  fastify.post("/admin/clients", {
    schema: {
      body: {
        type: "object",
        required: ["businessName", "ownerName", "email", "phone", "city", "password", "ownerWhatsapp"],
        properties: {
          businessName: { type: "string" },
          ownerName: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          city: { type: "string" },
          zone: { type: "string" },
          password: { type: "string", minLength: 6 },
          ownerWhatsapp: { type: "string" },
          language: { type: "string", enum: ["hinglish", "hindi", "english"] },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: {
      businessName: string; ownerName: string; email: string; phone: string;
      city: string; zone?: string; password: string; ownerWhatsapp: string;
      language?: string;
    };
  }>, reply: FastifyReply) => {
    const { businessName, ownerName, email, phone, city, zone, password, ownerWhatsapp, language } = request.body;
    const adminId = request.userId;

    // Check territory availability
    const existingTerritory = await fastify.prisma.territory.findFirst({
      where: { city, zone: zone || null, locked: true },
    });
    if (existingTerritory) {
      return reply.status(409).send({ error: "This territory is already assigned to another client" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const client = await fastify.prisma.client.create({
      data: {
        adminId,
        businessName,
        ownerName,
        email,
        phone,
        city,
        zone,
        passwordHash,
        ownerWhatsapp,
        language: language || "hinglish",
      },
    });

    // Auto-assign territory
    const territory = await fastify.prisma.territory.findFirst({
      where: { city, zone: zone || null, locked: false },
    });

    if (territory) {
      await assignTerritory(fastify.prisma, client.id, city, zone);
    }

    return reply.status(201).send({ client });
  });

  // ─── Get Client ───────────────────────────────────────────────
  fastify.get("/admin/clients/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.params.id },
      include: {
        territory: true,
        webhookSources: true,
        _count: { select: { leads: true, calls: true, bookings: true } },
      },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    return { client };
  });

  // ─── Update Client ────────────────────────────────────────────
  fastify.patch("/admin/clients/:id", async (request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.update({
      where: { id: request.params.id },
      data: request.body as any, // Admin update — intentional broad cast
    });
    return { client };
  });

  // ─── Delete Client (soft-deactivate) ──────────────────────────
  fastify.delete("/admin/clients/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    // Set plan to CANCELLED and release territory
    await fastify.prisma.client.update({
      where: { id: request.params.id },
      data: { planStatus: "CANCELLED" },
    });

    // Release any territory
    const clientTerritory = await fastify.prisma.territory.findFirst({
      where: { clientId: request.params.id },
    });
    if (clientTerritory) {
      await fastify.prisma.territory.update({
        where: { id: clientTerritory.id },
        data: { clientId: null, locked: false },
      });
    }

    return { message: "Client deactivated" };
  });

  // ─── Assign Territory ─────────────────────────────────────────
  fastify.post("/admin/clients/:id/assign-territory", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { city: string; zone?: string };
  }>, reply: FastifyReply) => {
    try {
      const result = await assignTerritory(fastify.prisma, request.params.id, request.body.city, request.body.zone);
      return result;
    } catch (error: any) {
      return reply.status(409).send({ error: error.message });
    }
  });

  // ─── Generate Agent Script ───────────────────────────────────
  fastify.post("/admin/clients/:id/create-agent", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({ where: { id: request.params.id } });
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // Generate AI call script
    const script = await generateCallScript({
      businessName: client.businessName,
      ownerName: client.ownerName,
      propertyTypes: ["flat", "villa", "plot"],
      locations: [client.city, client.zone].filter(Boolean) as string[],
      language: client.language,
    });

    // Update client with script
    await fastify.prisma.client.update({
      where: { id: client.id },
      data: { callScript: JSON.parse(JSON.stringify({ script })) },
    });

    return { script };
  });

  // ─── Update Script ────────────────────────────────────────────
  fastify.patch("/admin/clients/:id/script", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { script: Record<string, unknown> };
  }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.update({
      where: { id: request.params.id },
      data: { callScript: request.body.script as Prisma.InputJsonValue },
    });
    return { callScript: client.callScript };
  });
}

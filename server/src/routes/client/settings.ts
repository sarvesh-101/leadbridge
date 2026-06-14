import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";

export default async function clientSettingsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Get Profile ──────────────────────────────────────────────
  fastify.get("/me", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      include: { territory: true, _count: { select: { leads: true, calls: true } } },
    });
    return { client };
  });

  // ─── Update Profile ───────────────────────────────────────────
  fastify.patch("/me", async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    const allowedFields = ["ownerWhatsapp", "language", "leadSources"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (request.body[field] !== undefined) {
        updates[field] = request.body[field];
      }
    }

    const client = await fastify.prisma.client.update({
      where: { id: request.clientId },
      data: updates,
    });
    return { client };
  });

  // ─── Get Usage ────────────────────────────────────────────────
  fastify.get("/me/usage", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: {
        callsThisMonth: true,
        callsLimit: true,
        plan: true,
        planStatus: true,
        trialEndsAt: true,
      },
    });

    if (!client) {
      return { error: "Client not found" };
    }

    return {
      callsThisMonth: client.callsThisMonth,
      callsLimit: client.callsLimit,
      callsRemaining: client.callsLimit - client.callsThisMonth,
      plan: client.plan,
      planStatus: client.planStatus,
      trialEndsAt: client.trialEndsAt,
      daysLeftInTrial: client.trialEndsAt
        ? Math.max(0, Math.ceil((client.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0,
    };
  });

  // ─── List Webhook Sources ─────────────────────────────────────
  fastify.get("/settings/webhooks", async (request: FastifyRequest) => {
    const webhooks = await fastify.prisma.webhookSource.findMany({
      where: { clientId: request.clientId },
    });

    return { webhooks };
  });

  // ─── Create Webhook Source ────────────────────────────────────
  fastify.post("/settings/webhooks", async (request: FastifyRequest<{
    Body: { name: string; type: string; parserConfig: Record<string, unknown> };
  }>, reply: FastifyReply) => {
    const source = await fastify.prisma.webhookSource.create({
      data: {
        clientId: request.clientId!,
        name: request.body.name,
        type: request.body.type,
        parserConfig: (request.body.parserConfig ?? {}) as Prisma.InputJsonValue,
      },
    });

    return reply.status(201).send({ source });
  });

  // ─── Delete Webhook Source ────────────────────────────────────
  fastify.delete("/settings/webhooks/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await fastify.prisma.webhookSource.delete({
      where: { id: request.params.id, clientId: request.clientId },
    });
    return { message: "Webhook source deleted" };
  });

  // ─── Get Script ───────────────────────────────────────────────
  fastify.get("/settings/script", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { callScript: true, language: true },
    });
    return { script: client?.callScript, language: client?.language };
  });
}

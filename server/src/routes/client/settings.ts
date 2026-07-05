import crypto from "node:crypto";
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
    const allowedFields = ["ownerWhatsapp", "language", "leadSources", "phoneSetupStatus", "ownerName", "businessName", "phone", "name", "city", "zone"];
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

  // ─── Update Webhook Source ────────────────────────────────────
  // Ported from FastAPI: PUT /integrations/webhooks/{webhook_id}
  fastify.patch("/settings/webhooks/:id", async (request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>, reply: FastifyReply) => {
    const webhook = await fastify.prisma.webhookSource.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!webhook) {
      return reply.status(404).send({ error: "Webhook source not found" });
    }

    const updatable = ["name", "type", "parserConfig", "active"];
    const data = Object.fromEntries(
      updatable.filter((k) => k in request.body).map((k) => [k, (request.body as Record<string, unknown>)[k]])
    );

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const updated = await fastify.prisma.webhookSource.update({
      where: { id: webhook.id },
      data: data as any,
    });

    return { webhook: updated };
  });

  // ─── Regenerate Webhook Token ─────────────────────────────────
  // Ported from FastAPI: POST /integrations/webhooks/{webhook_id}/regenerate-secret
  fastify.post("/settings/webhooks/:id/regenerate", async (
    request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply
  ) => {
    const webhook = await fastify.prisma.webhookSource.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!webhook) {
      return reply.status(404).send({ error: "Webhook source not found" });
    }

    const newToken = crypto.randomUUID();

    const updated = await fastify.prisma.webhookSource.update({
      where: { id: webhook.id },
      data: { token: newToken },
    });

    return {
      message: "Webhook token regenerated",
      token: updated.token,
      webhookUrl: `/api/v1/webhooks/ingest/${updated.token}`,
    };
  });

  // ─── Test Webhook Source ───────────────────────────────────────
  // Ported from FastAPI: POST /integrations/webhooks/{webhook_id}/test
  fastify.post("/settings/webhooks/:id/test", async (
    request: FastifyRequest<{ Params: { id: string }; Body: { payload?: Record<string, unknown> } }>, reply: FastifyReply
  ) => {
    const webhook = await fastify.prisma.webhookSource.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!webhook) {
      return reply.status(404).send({ error: "Webhook source not found" });
    }

    // Simulate a test lead ingestion
    const testPayload = request.body.payload || {
      name: "Test Lead",
      phone: "9876543210",
      email: "test@example.com",
      source: webhook.name,
    };

    return {
      status: "success",
      message: "Test webhook processed successfully",
      webhook: {
        id: webhook.id,
        name: webhook.name,
        type: webhook.type,
        token: webhook.token,
        webhookUrl: `/api/v1/webhooks/ingest/${webhook.token}`,
      },
      payload: testPayload,
    };
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

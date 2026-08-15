import crypto from "node:crypto";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import { getBrokerCredits } from "../../services/credit-manager.service";
import { getMonthlyLeadsLimit } from "../../utils/lead-limits";
import { PRIVACY_POLICY_VERSION } from "../../config";

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
        rolloverCalls: true,
        leadsThisMonth: true,
        plan: true,
        planStatus: true,
        trialEndsAt: true,
      },
    });

    if (!client) {
      return { error: "Client not found" };
    }

    const credits = await getBrokerCredits(fastify.prisma, request.clientId!);

    return {
      callsThisMonth: client.callsThisMonth,
      callsLimit: client.callsLimit,
      rolloverCalls: client.rolloverCalls,
      // FIX Round-2 #6: expose real monthly leads usage vs plan cap
      leadsThisMonth: client.leadsThisMonth,
      leadsLimit: getMonthlyLeadsLimit(client.plan),
      totalAvailable: credits.totalAvailable,
      totalRemaining: credits.totalRemaining,
      usagePercent: credits.usagePercent,
      needsWarning: credits.needsWarning,
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
      data: data as Record<string, unknown>,
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

  // ─── DPDP Phase 1.3 — Privacy: consent + data erasure ─────────
  // Erasure SLA promised in the Privacy Policy (section 4 / 6).
  const ERASURE_SLA_DAYS = 30;

  // Get current consent + erasure state (for the Settings → Privacy tab)
  fastify.get("/me/privacy", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: {
        consentGivenAt: true,
        consentVersion: true,
        dataErasureRequestedAt: true,
        dataErasureProcessedAt: true,
      },
    });
    if (!client) {
      return { error: "Client not found" };
    }
    return {
      consentGivenAt: client.consentGivenAt,
      consentVersion: client.consentVersion,
      consentActive: !!client.consentGivenAt,
      erasureRequested: !!client.dataErasureRequestedAt,
      erasureRequestedAt: client.dataErasureRequestedAt,
      erasureProcessedAt: client.dataErasureProcessedAt,
      slaDays: ERASURE_SLA_DAYS,
      privacyPolicyUrl: "/legal/privacy",
    };
  });

  // Re-affirm consent to the current Privacy Policy version
  fastify.post("/me/privacy/consent", async (request: FastifyRequest, reply: FastifyReply) => {
    await fastify.prisma.client.update({
      where: { id: request.clientId },
      data: { consentGivenAt: new Date(), consentVersion: PRIVACY_POLICY_VERSION },
    });
    return { consentGivenAt: new Date(), consentVersion: PRIVACY_POLICY_VERSION };
  });

  // DPDP right to erasure / consent withdrawal. Sets a request flag + notifies
  // admins (the actual deletion is a supervised admin action so the broker
  // keeps access until it is carried out).
  // Atomic: the conditional updateMany ensures only ONE concurrent request
  // wins the flag (no duplicate notifications on double-submit).
  fastify.post("/me/privacy/erasure-request", async (request: FastifyRequest, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: {
        businessName: true,
        email: true,
        dataErasureRequestedAt: true,
        dataErasureProcessedAt: true,
      },
    });
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    if (client.dataErasureProcessedAt) {
      return reply.status(400).send({ error: "Your data erasure has already been processed." });
    }

    const requestedAt = new Date();
    const updated = await fastify.prisma.client.updateMany({
      where: {
        id: request.clientId,
        dataErasureRequestedAt: null,
        dataErasureProcessedAt: null,
      },
      data: { dataErasureRequestedAt: requestedAt },
    });

    if (updated.count > 0) {
      await fastify.prisma.ownerNotification.create({
        data: {
          clientId: request.clientId!,
          type: "DATA_ERASURE_REQUEST",
          message: `${client.businessName} (${client.email}) requested full account & data erasure (DPDP). Complete the deletion and set dataErasureProcessedAt.`,
          status: "sent",
        },
      });
      fastify.log.info(
        { clientId: request.clientId, email: client.email },
        "DPDP data erasure request recorded"
      );
    }

    // Idempotent response: if a concurrent request already set the flag, report
    // the original requestedAt (re-read for the real value).
    const existing = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { dataErasureRequestedAt: true, dataErasureProcessedAt: true },
    });
    if (existing?.dataErasureProcessedAt) {
      return reply.status(400).send({ error: "Your data erasure has already been processed." });
    }

    return {
      erasureRequested: true,
      erasureRequestedAt: existing?.dataErasureRequestedAt ?? requestedAt,
      slaDays: ERASURE_SLA_DAYS,
      message: `Your request has been received. We will delete your account and personal data within ${ERASURE_SLA_DAYS} days, as stated in our Privacy Policy.`,
    };
  });
}

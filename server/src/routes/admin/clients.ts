import crypto from "node:crypto";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { assignTerritory } from "../../services/territory.service";
import { generateCallScript } from "../../services/deepseek.service";

/**
 * Pro-rated refund calculation helper.
 * Used by admin cancellation endpoints and broker self-cancellation.
 * Creates a credit note (REFUNDED invoice) if a PAID invoice exists with unused days.
 */
async function calculateAndCreateRefund(
  fastify: FastifyInstance,
  clientId: string
): Promise<{ refundAmount: number; refundNote: string } | null> {
  const now = new Date();

  // Find the cancelled subscription's paid invoice for refund calculation
  // Subscription is already cancelled by the caller — we just need to create credit note
  const subscription = await fastify.prisma.subscription.findFirst({
    where: { clientId, status: "CANCELLED" },
    orderBy: { cancelledAt: "desc" },
    include: { invoices: { where: { status: "PAID" }, orderBy: { issueDate: "desc" }, take: 1 } },
  });

  if (!subscription) return null;

  const paidInvoice = subscription.invoices[0];
  if (!paidInvoice) return null;

  const periodStart = paidInvoice.periodStart || subscription.startDate;
  const periodEnd = paidInvoice.periodEnd || subscription.endDate;
  const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const daysUsed = Math.max(0, Math.round((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingDays = Math.max(0, totalDays - daysUsed);

  if (remainingDays <= 0 || totalDays <= 0) return null;

  const refundAmount = Math.round((remainingDays / totalDays) * paidInvoice.totalAmount * 100) / 100;
  const refundNote = `Pro-rated refund: ₹${refundAmount} for ${remainingDays}/${totalDays} days remaining (admin deactivation)`;

  // Create refund credit note
  await fastify.prisma.invoice.create({
    data: {
      clientId,
      subscriptionId: subscription.id,
      invoiceNumber: `CN-${Date.now()}-${clientId.slice(-4)}`,
      status: "REFUNDED",
      description: refundNote,
      amount: -refundAmount,
      totalAmount: -refundAmount,
      issueDate: now,
      dueDate: now,
      periodStart: paidInvoice.periodStart || subscription.startDate,
      periodEnd: now,
    },
  });

  fastify.log.info({ clientId, refundAmount, remainingDays, totalDays }, "Admin deactivation — refund calculated");
  return { refundAmount, refundNote };
}

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
  // SAFE: Only whitelisted fields can be updated — prevents mass-assignment
  const CLIENT_UPDATABLE_FIELDS = [
    "businessName", "ownerName", "email", "phone", "city", "zone",
    "language", "ownerWhatsapp", "planStatus", "plan", "callsLimit",
    "onboardingComplete", "onboardingStep", "callScript", "knowledgeBase",
    "agentVoiceId", "leadSources", "omnidimensionAgentId", "omniAgentId",
    "omniPhoneNumberId", "omniPhoneNumber", "phoneSetupStatus",
  ] as const;

  fastify.patch("/admin/clients/:id", async (request: FastifyRequest<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>, reply: FastifyReply) => {
    // Only allow whitelisted fields — prevents overwriting passwordHash, adminId, etc.
    const data = Object.fromEntries(
      CLIENT_UPDATABLE_FIELDS
        .filter((k) => k in request.body)
        .map((k) => [k, request.body[k]])
    );

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const client = await fastify.prisma.client.update({
      where: { id: request.params.id },
      data: data as Record<string, unknown>,
    });
    return { client };
  });

  // ─── Update Client Status ──────────────────────────────────────
  // Ported from FastAPI: PATCH /admin/clients/{tenant_id}/status
  fastify.patch("/admin/clients/:id/status", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { status?: string; plan?: string; callsLimit?: number; notes?: string };
  }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.params.id },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    const updateData: Record<string, unknown> = {};

    const { status, plan, callsLimit, notes } = request.body;

    const validStatuses = ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"];
    if (status && validStatuses.includes(status)) {
      updateData.planStatus = status;
    } else if (status) {
      return reply.status(400).send({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const validPlans = ["STARTER", "GROWTH", "PRO"];
    if (plan && validPlans.includes(plan)) {
      updateData.plan = plan;
    } else if (plan) {
      return reply.status(400).send({
        error: `Invalid plan. Must be one of: ${validPlans.join(", ")}`,
      });
    }

    if (callsLimit !== undefined) {
      updateData.callsLimit = callsLimit;
    }

    // If setting status to CANCELLED, calculate pro-rated refund
    let refundInfo = null;
    if (status === "CANCELLED" && client.planStatus !== "CANCELLED") {
      refundInfo = await calculateAndCreateRefund(fastify, request.params.id);
    }

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({ error: "No valid fields to update" });
    }

    const updated = await fastify.prisma.client.update({
      where: { id: request.params.id },
      data: updateData,
    });

    return {
      message: `Client '${updated.businessName}' updated`,
      status: updated.planStatus,
      plan: updated.plan,
      ...(refundInfo ? { refund: refundInfo } : {}),
    };
  });

  // ─── Reset Client Password ─────────────────────────────────────
  // Ported from FastAPI: POST /admin/clients/{tenant_id}/reset-password
  fastify.post("/admin/clients/:id/reset-password", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.params.id },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    const tempPassword = crypto.randomUUID().split("-").pop() + "A1!";
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await fastify.prisma.client.update({
      where: { id: client.id },
      data: { passwordHash },
    });

    return {
      message: `Password reset for ${client.email}`,
      temporaryPassword: tempPassword,
      userEmail: client.email,
    };
  });

  // ─── Delete Client (soft-deactivate) ──────────────────────────
  fastify.delete("/admin/clients/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({ where: { id: request.params.id } });
    if (!client) return reply.status(404).send({ error: "Client not found" });

    // Always cancel the active subscription first
    const now = new Date();
    await fastify.prisma.subscription.updateMany({
      where: { clientId: request.params.id, status: { in: ["ACTIVE", "TRIAL"] } },
      data: { status: "CANCELLED", cancelledAt: now },
    });

    // Then calculate pro-rated refund if a paid invoice exists
    const refundInfo = await calculateAndCreateRefund(fastify, request.params.id);

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

    return {
      message: "Client deactivated",
      ...(refundInfo ? { refund: refundInfo } : {}),
    };
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

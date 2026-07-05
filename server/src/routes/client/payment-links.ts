/**
 * Payment Link Routes — Share payment links with leads via WhatsApp/SMS.
 *
 * Allows brokers to:
 * - Create payment links for booking fees or deposits
 * - Send links via WhatsApp to leads
 * - Track payment status
 * - View payment history per lead
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";

export default async function paymentLinkRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Payment Links ─────────────────────────────────────
  fastify.get("/payment-links", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { leadId, status, page = "1", limit = "20" } =
      request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };
    if (leadId) where.leadId = leadId;
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      fastify.prisma.paymentLink.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          lead: { select: { name: true, phone: true } },
        },
      }),
      fastify.prisma.paymentLink.count({ where }),
    ]);

    return { items, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── Create Payment Link ────────────────────────────────────
  fastify.post("/payment-links", {
    schema: {
      body: {
        type: "object",
        required: ["amount"],
        properties: {
          amount: { type: "number", minimum: 1 },
          currency: { type: "string", default: "INR" },
          description: { type: "string" },
          leadId: { type: "string" },
          expiresInDays: { type: "integer", minimum: 1, maximum: 30, default: 7 },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: {
      amount: number;
      currency?: string;
      description?: string;
      leadId?: string;
      expiresInDays?: number;
    };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { amount, currency, description, leadId, expiresInDays } = request.body;

    // If leadId provided, verify it belongs to this client
    let leadName: string | null = null;
    let leadPhone: string | null = null;
    if (leadId) {
      const lead = await fastify.prisma.lead.findFirst({
        where: { id: leadId, clientId },
        select: { name: true, phone: true },
      });
      if (!lead) {
        return reply.status(404).send({ error: "Lead not found" });
      }
      leadName = lead.name;
      leadPhone = lead.phone;
    }

    // Generate a unique short code for the payment link
    const shortCode = crypto.randomBytes(4).toString("hex");
    const { config } = await import("../../config");
    const shortUrl = `${config.FRONTEND_URL || "http://localhost:3000"}/pay/${shortCode}`;

    const paymentLink = await fastify.prisma.paymentLink.create({
      data: {
        clientId,
        leadId: leadId || null,
        amount: Math.round(amount * 100) / 100,
        currency: currency || "INR",
        description: description || null,
        leadName,
        leadPhone,
        shortUrl,
        status: "PENDING",
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    return reply.status(201).send({ paymentLink });
  });

  // ─── Send Payment Link to Lead via WhatsApp ─────────────────
  fastify.post("/payment-links/:id/send", {
    schema: {
      body: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["whatsapp", "sms"], default: "whatsapp" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Params: { id: string };
    Body: { channel?: "whatsapp" | "sms" };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const paymentLink = await fastify.prisma.paymentLink.findFirst({
      where: { id: request.params.id, clientId },
      include: { lead: { select: { phone: true, name: true } } },
    });

    if (!paymentLink) {
      return reply.status(404).send({ error: "Payment link not found" });
    }

    const targetPhone = paymentLink.leadPhone || paymentLink.lead?.phone;
    if (!targetPhone) {
      return reply.status(400).send({ error: "No phone number associated with this payment link" });
    }

    const channel = request.body.channel || "whatsapp";
    const amountFormatted = `₹${paymentLink.amount.toLocaleString("en-IN")}`;
    const message = `🔗 Payment Link\n\nAmount: ${amountFormatted}\nDescription: ${paymentLink.description || "Booking payment"}\n\nClick to pay: ${paymentLink.shortUrl}\n\nThank you!`;

    if (channel === "whatsapp") {
      const { sendTextMessage } = await import("../../services/whatsapp.service");
      await sendTextMessage({ to: targetPhone, text: message, recipientType: "customer" });
    } else {
      const { sendSms } = await import("../../services/sms.service");
      await sendSms(targetPhone, `Pay ${amountFormatted}: ${paymentLink.shortUrl}`);
    }

    // Update sent tracking
    await fastify.prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: { sentVia: channel, sentAt: new Date() },
    });

    // Create notification record
    if (paymentLink.leadId) {
      await fastify.prisma.customerNotification.create({
        data: {
          leadId: paymentLink.leadId,
          type: "PAYMENT_LINK",
          channel,
          message: `Payment link for ${amountFormatted} sent via ${channel}`,
          status: "sent",
          sentAt: new Date(),
        },
      });
    }

    // Audit log
    await fastify.prisma.auditLog.create({
      data: {
        clientId,
        action: "payment_link.sent",
        resourceType: "payment_link",
        resourceId: paymentLink.id,
        changes: { channel, amount: paymentLink.amount },
        status: "success",
      },
    });

    return { success: true, channel, sentTo: targetPhone };
  });

  // ─── Get Payment Link ───────────────────────────────────────
  fastify.get("/payment-links/:id", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const paymentLink = await fastify.prisma.paymentLink.findFirst({
      where: { id: request.params.id, clientId },
      include: { lead: { select: { name: true, phone: true, status: true } } },
    });

    if (!paymentLink) {
      return reply.status(404).send({ error: "Payment link not found" });
    }

    return { paymentLink };
  });

  // ─── Cancel Payment Link ────────────────────────────────────
  fastify.patch("/payment-links/:id/cancel", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const paymentLink = await fastify.prisma.paymentLink.findFirst({
      where: { id: request.params.id, clientId, status: "PENDING" },
    });

    if (!paymentLink) {
      return reply.status(404).send({ error: "Payment link not found or already paid/cancelled" });
    }

    await fastify.prisma.paymentLink.update({
      where: { id: paymentLink.id },
      data: { status: "CANCELLED" },
    });

    await fastify.prisma.auditLog.create({
      data: {
        clientId,
        action: "payment_link.cancelled",
        resourceType: "payment_link",
        resourceId: paymentLink.id,
        status: "success",
      },
    });

    return { success: true };
  });

  // ─── Public: Verify Payment (no auth — uses short code) ─────
  fastify.get("/pay/:code", async (request: FastifyRequest<{
    Params: { code: string };
  }>, reply: FastifyReply) => {
    const paymentLink = await fastify.prisma.paymentLink.findFirst({
      where: { shortUrl: { contains: request.params.code } },
    });

    if (!paymentLink) {
      return reply.status(404).send({ error: "Payment link not found" });
    }

    if (paymentLink.status === "PAID") {
      return { status: "PAID", paidAt: paymentLink.paidAt };
    }

    if (paymentLink.expiresAt && paymentLink.expiresAt < new Date()) {
      return { status: "EXPIRED" };
    }

    return {
      status: paymentLink.status,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      description: paymentLink.description,
    };
  });

  // ─── Payment Link Summary ──────────────────────────────────
  fastify.get("/payment-links/summary", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    const [total, paid, pending, expired] = await Promise.all([
      fastify.prisma.paymentLink.count({ where: { clientId } }),
      fastify.prisma.paymentLink.count({ where: { clientId, status: "PAID" } }),
      fastify.prisma.paymentLink.count({ where: { clientId, status: "PENDING" } }),
      fastify.prisma.paymentLink.count({ where: { clientId, status: "EXPIRED" } }),
    ]);

    // Total amount collected
    const paidLinks = await fastify.prisma.paymentLink.findMany({
      where: { clientId, status: "PAID" },
      select: { amount: true },
    });
    const totalCollected = paidLinks.reduce((sum, p) => sum + p.amount, 0);

    return {
      total,
      paid,
      pending,
      expired,
      totalCollected: Math.round(totalCollected * 100) / 100,
    };
  });
}

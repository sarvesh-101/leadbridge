import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendTextMessage } from "../../services/whatsapp.service";

export default async function clientMessageRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Conversations ────────────────────────────────────────
  fastify.get("/messages/conversations", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const { search } = request.query as Record<string, string>;

    // Get all leads with their latest notification
    const where: Record<string, unknown> = { clientId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const leads = await fastify.prisma.lead.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        source: true,
        score: true,
        customerNotifications: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: {
            id: true,
            type: true,
            channel: true,
            message: true,
            status: true,
            sentAt: true,
          },
        },
        _count: {
          select: { customerNotifications: true },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
    });

    // Format conversations
    const conversations = leads
      .filter((l) => l.customerNotifications.length > 0 || l.phone)
      .map((l) => ({
        leadId: l.id,
        name: l.name,
        phone: l.phone,
        status: l.status,
        source: l.source,
        score: l.score,
        lastMessage: l.customerNotifications[0] || null,
        messageCount: l._count.customerNotifications,
      }))
      .sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime();
      });

    return { conversations };
  });

  // ─── Get Conversation (message thread for a specific lead) ────
  fastify.get("/messages/conversations/:leadId", async (request: FastifyRequest<{
    Params: { leadId: string };
  }>) => {
    const clientId = request.clientId!;
    const { leadId } = request.params;

    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        source: true,
        score: true,
        email: true,
        customerNotifications: {
          orderBy: { sentAt: "asc" },
          take: 100,
        },
        calls: {
          where: { transcript: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            status: true,
            duration: true,
            summary: true,
            createdAt: true,
          },
        },
      },
    });

    if (!lead) {
      return { conversation: null, messages: [] };
    }

    return {
      conversation: {
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        source: lead.source,
        score: lead.score,
        email: lead.email,
      },
      messages: lead.customerNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        channel: n.channel,
        message: n.message,
        status: n.status,
        sentAt: n.sentAt.toISOString(),
        isFromLead: n.type === "INCOMING_WHATSAPP" || n.type === "INCOMING_SMS",
        isFromBot: n.type === "CHATBOT_REPLY",
      })),
      recentCalls: lead.calls,
    };
  });

  // ─── Send WhatsApp Message ────────────────────────────────────
  fastify.post("/messages/send", {
    schema: {
      body: {
        type: "object",
        required: ["leadId", "message"],
        properties: {
          leadId: { type: "string" },
          message: { type: "string", minLength: 1, maxLength: 4096 },
        },
      },
    },
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{
    Body: { leadId: string; message: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { leadId, message } = request.body;

    // Verify lead belongs to client
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    // Send via WhatsApp
    const waMessageId = await sendTextMessage({
      to: lead.phone,
      text: message,
      recipientType: "customer",
    });

    // Log the outgoing message
    const notification = await fastify.prisma.customerNotification.create({
      data: {
        leadId: lead.id,
        type: "BROKER_REPLY",
        channel: waMessageId ? "whatsapp" : "sms",
        message,
        status: waMessageId ? "sent" : "failed",
        waMessageId: waMessageId || undefined,
        sentAt: new Date(),
      },
    });

    if (!waMessageId) {
      return reply.status(500).send({ error: "Failed to send WhatsApp message. Check your WhatsApp configuration." });
    }

    return { message: "Sent", notification };
  });

  // ─── Mark Conversation as Read ─────────────────────────────────
  fastify.post("/messages/conversations/:leadId/read", async (request: FastifyRequest<{
    Params: { leadId: string };
  }>) => {
    const clientId = request.clientId!;
    const { leadId } = request.params;

    // Verify lead belongs to client
    const lead = await fastify.prisma.lead.findFirst({
      where: { id: leadId, clientId },
    });

    if (!lead) {
      return { error: "Lead not found" };
    }

    // Mark all incoming unread messages as read
    await fastify.prisma.customerNotification.updateMany({
      where: {
        leadId,
        type: "INCOMING_WHATSAPP",
        status: "received",
      },
      data: { status: "read" },
    });

    return { success: true };
  });
}

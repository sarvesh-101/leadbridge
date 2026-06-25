/**
 * Messages API Route
 *
 * GET /api/v1/messages — Returns real message logs from the database:
 *   - OwnerNotification — WhatsApp messages sent to broker (owner)
 *   - CustomerNotification — WhatsApp messages sent to leads
 *   - Call records with transcripts (phone calls)
 *
 * Previously the frontend was fabricating message data from calls + leads.
 * This endpoint provides a clean, paginated, filterable message history.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface MessagesQuery {
  page?: string;
  limit?: string;
  channel?: "all" | "whatsapp" | "phone";
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export default async function messagesRoutes(fastify: FastifyInstance) {
  // ─── List Messages ─────────────────────────────────────────
  fastify.get("/messages", async (request: FastifyRequest<{ Querystring: MessagesQuery }>, reply: FastifyReply) => {
    const clientId = request.clientId;
    const {
      page = "1",
      limit = "30",
      channel = "all",
      search,
      status,
      startDate,
      endDate,
    } = request.query;

    const take = parseInt(limit);
    // Fetch a generous batch from each source so client-side sorting/searching works
    const FETCH_BATCH = 200;

    const dateFilter: Record<string, unknown> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Build Prisma where clauses
    const ownerWhere: Record<string, unknown> = { clientId };
    if (status) ownerWhere.status = status;
    if (hasDateFilter) ownerWhere.sentAt = dateFilter;

    const customerWhere: Record<string, unknown> = {
      lead: { clientId },
    };
    if (status) customerWhere.status = status;
    if (hasDateFilter) customerWhere.sentAt = dateFilter;

    const callWhere: Record<string, unknown> = { clientId };
    if (status) callWhere.status = status;
    if (hasDateFilter) callWhere.createdAt = dateFilter;

    // ─── Fetch all 3 sources in parallel ──────────────────
    const [ownerNotifications, customerNotifications, calls] = await Promise.all([
      channel === "all" || channel === "whatsapp"
        ? fastify.prisma.ownerNotification.findMany({
            where: ownerWhere,
            include: { lead: { select: { name: true, phone: true } } },
            orderBy: { sentAt: "desc" },
            take: FETCH_BATCH,
          })
        : ([] as any[]),

      channel === "all" || channel === "whatsapp"
        ? fastify.prisma.customerNotification.findMany({
            where: customerWhere,
            include: { lead: { select: { name: true, phone: true } } },
            orderBy: { sentAt: "desc" },
            take: FETCH_BATCH,
          })
        : ([] as any[]),

      channel === "all" || channel === "phone"
        ? fastify.prisma.call.findMany({
            where: callWhere,
            include: { lead: { select: { name: true, phone: true } } },
            orderBy: { createdAt: "desc" },
            take: FETCH_BATCH,
          })
        : ([] as any[]),
    ]);

    // ─── Normalize into unified message format ─────────────
    const messages: Array<{
      id: string;
      type: "whatsapp" | "phone";
      direction: "outbound" | "inbound";
      recipientType: "owner" | "customer";
      recipientName: string | null;
      recipientPhone: string | null;
      content: string;
      status: string;
      template: string | null;
      duration: number | null;
      sentAt: string;
    }> = [];

    for (const n of ownerNotifications) {
      messages.push({
        id: `on-${n.id}`,
        type: "whatsapp",
        direction: "outbound",
        recipientType: "owner",
        recipientName: null,
        recipientPhone: null,
        content: n.message || "",
        status: n.status,
        template: n.type,
        duration: null,
        sentAt: n.sentAt.toISOString(),
      });
    }

    for (const n of customerNotifications) {
      messages.push({
        id: `cn-${n.id}`,
        type: "whatsapp",
        direction: "outbound",
        recipientType: "customer",
        recipientName: (n as any).lead?.name || null,
        recipientPhone: null,
        content: n.message || "",
        status: n.status,
        template: n.type,
        duration: null,
        sentAt: n.sentAt.toISOString(),
      });
    }

    for (const c of calls) {
      messages.push({
        id: `call-${c.id}`,
        type: "phone",
        direction: (c.direction as "outbound" | "inbound") || "outbound",
        recipientType: "customer",
        recipientName: (c as any).lead?.name || null,
        recipientPhone: (c as any).lead?.phone || null,
        content: c.summary || c.transcript || `Call duration: ${c.duration || 0}s`,
        status: c.status,
        template: c.type,
        duration: c.duration || null,
        sentAt: c.createdAt.toISOString(),
      });
    }

    // Sort by sentAt descending
    messages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

    // Apply search filter to merged results
    const filtered = search
      ? messages.filter(
          (m) =>
            m.recipientName?.toLowerCase().includes(search.toLowerCase()) ||
            m.recipientPhone?.includes(search) ||
            m.content.toLowerCase().includes(search.toLowerCase())
        )
      : messages;

    // Paginate on the merged + filtered set
    const skip = (parseInt(page) - 1) * take;
    const paginated = filtered.slice(skip, skip + take);

    return {
      messages: paginated,
      total: filtered.length,
      page: parseInt(page),
      limit: take,
    };
  });

  // ─── Get Single Message ──────────────────────────────────
  fastify.get("/messages/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId;
    const { id } = request.params;

    // Parse the prefix to know which table to query
    if (id.startsWith("on-")) {
      const notification = await fastify.prisma.ownerNotification.findUnique({
        where: { id: id.replace("on-", "") },
        include: { lead: true, booking: true },
      });
      if (!notification || notification.clientId !== clientId) {
        return reply.status(404).send({ error: "Message not found" });
      }
      return {
        id: `on-${notification.id}`,
        type: "whatsapp",
        recipientType: "owner",
        content: notification.message,
        status: notification.status,
        template: notification.type,
        sentAt: notification.sentAt,
        lead: notification.lead ? { name: notification.lead.name, phone: notification.lead.phone } : null,
        booking: notification.booking,
      };
    }

    if (id.startsWith("cn-")) {
      const notification = await fastify.prisma.customerNotification.findUnique({
        where: { id: id.replace("cn-", "") },
        include: { lead: true },
      });
      if (!notification || notification.lead?.clientId !== clientId) {
        return reply.status(404).send({ error: "Message not found" });
      }
      return {
        id: `cn-${notification.id}`,
        type: "whatsapp",
        recipientType: "customer",
        content: notification.message,
        status: notification.status,
        template: notification.type,
        sentAt: notification.sentAt,
        lead: notification.lead ? { name: notification.lead.name, phone: notification.lead.phone } : null,
      };
    }

    if (id.startsWith("call-")) {
      const call = await fastify.prisma.call.findUnique({
        where: { id: id.replace("call-", "") },
        include: { lead: true },
      });
      if (!call || call.clientId !== clientId) {
        return reply.status(404).send({ error: "Message not found" });
      }
      return {
        id: `call-${call.id}`,
        type: "phone",
        content: call.summary || call.transcript,
        status: call.status,
        template: call.type,
        duration: call.duration,
        direction: call.direction,
        recordingUrl: call.recordingUrl,
        sentAt: call.createdAt,
        lead: call.lead ? { name: call.lead.name, phone: call.lead.phone } : null,
      };
    }

    return reply.status(404).send({ error: "Message not found" });
  });
}

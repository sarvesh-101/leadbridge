/**
 * Notifications Route — In-app notification center for brokers.
 *
 * Returns recent owner notifications (new leads, booking changes, etc.)
 * that would have been sent via WhatsApp, now also visible in-app.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Owner Notifications ─────────────────────────────────
  fastify.get("/notifications", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { limit = "20", unreadOnly } = request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };
    if (unreadOnly === "true") {
      where.readAt = null;
    }

    const [notifications, unreadCount] = await Promise.all([
      fastify.prisma.ownerNotification.findMany({
        where,
        orderBy: { sentAt: "desc" },
        take: Math.min(parseInt(limit), 50),
        select: {
          id: true,
          leadId: true,
          bookingId: true,
          type: true,
          message: true,
          status: true,
          sentAt: true,
          readAt: true,
        },
      }),
      fastify.prisma.ownerNotification.count({
        where: { clientId, readAt: null },
      }),
    ]);

    return { notifications, unreadCount, total: notifications.length };
  });

  // ─── Mark Notification as Read ────────────────────────────────
  fastify.patch("/notifications/:id/read", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const notif = await fastify.prisma.ownerNotification.findFirst({
      where: { id: request.params.id, clientId },
    });

    if (!notif) {
      return reply.status(404).send({ error: "Notification not found" });
    }

    await fastify.prisma.ownerNotification.update({
      where: { id: notif.id },
      data: { readAt: new Date() },
    });

    return { success: true };
  });

  // ─── Mark All Notifications as Read ───────────────────────────
  fastify.patch("/notifications/read-all", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    await fastify.prisma.ownerNotification.updateMany({
      where: { clientId, readAt: null },
      data: { readAt: new Date() },
    });

    return { success: true };
  });

  // ─── Get Unread Count Only (lightweight, for polling) ─────────
  fastify.get("/notifications/unread-count", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    const count = await fastify.prisma.ownerNotification.count({
      where: { clientId, readAt: null },
    });

    return { unreadCount: count };
  });
}

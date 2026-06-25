import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export default async function clientBookingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Bookings ────────────────────────────────────────────
  fastify.get("/bookings", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { page = "1", limit = "20", status } = request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      fastify.prisma.booking.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          lead: { select: { name: true, phone: true, source: true } },
        },
        orderBy: { visitDate: "desc" },
      }),
      fastify.prisma.booking.count({ where }),
    ]);

    return { bookings, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── Get Booking ──────────────────────────────────────────────
  fastify.get("/bookings/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const booking = await fastify.prisma.booking.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      include: {
        lead: true,
        ownerNotifications: { orderBy: { sentAt: "desc" } },
      },
    });

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    return { booking };
  });

  // ─── Mark Visited ─────────────────────────────────────────────
  fastify.patch("/bookings/:id/visited", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const booking = await fastify.prisma.booking.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
    });

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    const now = new Date();
    const [updatedBooking, _lead] = await Promise.all([
      fastify.prisma.booking.update({
        where: { id: booking.id },
        data: { status: "VISITED", visitedAt: now },
      }),
      fastify.prisma.lead.update({
        where: { bookingId: booking.id },
        data: { status: "VISITED", visitedAt: now },
      }),
    ]);

    return { booking: updatedBooking };
  });

  // ─── Reschedule Booking ─────────────────────────────────────────
  fastify.patch("/bookings/:id/reschedule", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { visitDate: string; visitTime: string };
  }>, reply: FastifyReply) => {
    const booking = await fastify.prisma.booking.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      include: { lead: true },
    });

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    const newDate = new Date(request.body.visitDate);
    if (isNaN(newDate.getTime())) {
      return reply.status(400).send({ error: "Invalid visitDate format. Use YYYY-MM-DD." });
    }

    const [updatedBooking, _lead] = await Promise.all([
      fastify.prisma.booking.update({
        where: { id: booking.id },
        data: {
          visitDate: newDate,
          visitTime: request.body.visitTime,
          status: "RESCHEDULED",
        },
      }),
      fastify.prisma.lead.update({
        where: { bookingId: booking.id },
        data: { status: "REBOOKED" },
      }),
    ]);

    return { booking: updatedBooking };
  });

  // ─── Cancel Booking ───────────────────────────────────────────
  fastify.patch("/bookings/:id/cancel", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { reason?: string };
  }>, reply: FastifyReply) => {
    const booking = await fastify.prisma.booking.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      include: { lead: true },
    });

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    const [updatedBooking, _lead] = await Promise.all([
      fastify.prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      }),
      fastify.prisma.lead.update({
        where: { bookingId: booking.id },
        data: { status: "COLD", coldAt: new Date() },
      }),
    ]);

    return { booking: updatedBooking };
  });
}

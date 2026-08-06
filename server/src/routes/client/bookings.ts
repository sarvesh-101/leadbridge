import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export default async function clientBookingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Create Booking (Quick-Add) ──────────────────────────────
  fastify.post("/bookings", async (request: FastifyRequest<{
    Body: { name: string; phone: string; visitDate: string; visitTime: string; propertyAddress?: string; notes?: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { name, phone, visitDate, visitTime, propertyAddress, notes } = request.body;

    if (!name || !phone || !visitDate) {
      return reply.status(400).send({ error: "name, phone, and visitDate are required" });
    }

    // Create or find existing lead by phone
    let lead = await fastify.prisma.lead.findFirst({
      where: { clientId, phone },
    });

    if (!lead) {
      // FIX Round-2 #6 (reviewer): booking quick-add creates a new lead — count
      // it against the monthly leads cap so no ingestion path bypasses the plan.
      const client = await fastify.prisma.client.findUnique({
        where: { id: clientId },
        select: { plan: true },
      });
      if (client) {
        const { checkMonthlyLeadsCapacity, monthlyLeadsCapError } = await import("../../utils/lead-limits");
        const monthly = await checkMonthlyLeadsCapacity(fastify.prisma, clientId, client.plan);
        if (!monthly.canIngest) {
          return reply.status(429).send(monthlyLeadsCapError(monthly.limit));
        }
      }

      lead = await fastify.prisma.lead.create({
        data: {
          clientId,
          name,
          phone,
          source: "manual",
          rawPayload: {},
          status: "BOOKED",
          bookedAt: new Date(),
          score: 50,
          receivedAt: new Date(),
        },
      });

      // Consume the allowance (race-safe)
      if (client) {
        const { tryConsumeMonthlyLead } = await import("../../utils/lead-limits");
        await tryConsumeMonthlyLead(fastify.prisma, clientId, client.plan);
      }
    } else {
      // Update lead status to rebooked
      await fastify.prisma.lead.update({
        where: { id: lead.id },
        data: { status: "REBOOKED", bookedAt: new Date() },
      });
    }

    const visitDateObj = new Date(visitDate);
    if (isNaN(visitDateObj.getTime())) {
      return reply.status(400).send({ error: "Invalid visitDate format. Use YYYY-MM-DD." });
    }

    // Create booking (no leadId field — relation is on Lead.bookingId)
    const booking = await fastify.prisma.booking.create({
      data: {
        clientId,
        visitDate: visitDateObj,
        visitTime: visitTime || "11:00 AM",
        propertyAddress: propertyAddress || "",
        notes: notes || "",
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });

    // Link lead to the newly created booking
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { bookingId: booking.id },
    });

    // Fetch the booking with lead details
    const enrichedBooking = await fastify.prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        lead: { select: { name: true, phone: true, source: true, score: true } },
      },
    });

    return reply.status(201).send({ booking: enrichedBooking });
  });

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

    // Remove any pending reminder job for the old booking date
    const { cancelReminderJob, enqueueReminder } = await import("../../workers/queues");
    await cancelReminderJob(booking.id).catch(() => {});

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

    // Schedule a NEW reminder for the rescheduled date
    const newReminderTime = new Date(newDate);
    newReminderTime.setHours(9, 0, 0, 0);
    const delayMs = Math.max(0, newReminderTime.getTime() - Date.now());
    if (delayMs > 0 && booking.lead?.id) {
      await enqueueReminder({ leadId: booking.lead.id, clientId: request.clientId!, bookingId: booking.id }, delayMs);
    }

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

    // Remove any pending reminder job from queue
    const { cancelReminderJob } = await import("../../workers/queues");
    await cancelReminderJob(booking.id).catch(() => {});

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

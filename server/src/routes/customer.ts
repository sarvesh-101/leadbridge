import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { generateAccessToken } from "../plugins/auth";
import { sendTextMessage } from "../services/whatsapp.service";
import { sendSms } from "../services/sms.service";
import { logger } from "../utils/logger";

/**
 * Helper to create a structured audit log entry with a consistent,
 * machine-readable action string and the request's IP/user-agent.
 */
async function logCustomerAction(
  fastify: FastifyInstance,
  params: {
    clientId: string;
    leadId: string;
    bookingId?: string;
    action: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }
): Promise<void> {
  const {
    clientId, leadId, bookingId, action, details,
    ip = "unknown",
    userAgent = "unknown",
  } = params;

  // Structured log line
  logger.info(
    { clientId, leadId, bookingId, action, ...details },
    `customer.${action}`
  );

  // Persist as an audit log entry so brokers can see it
  await fastify.prisma.auditLog.create({
    data: {
      clientId,
      userId: leadId,
      action: `customer.${action}`,
      resourceType: "lead",
      resourceId: leadId,
      changes: { ...details, bookingId },
      ipAddress: ip,
      userAgent,
      status: "success",
      metadata: { source: "customer_portal" },
    },
  }).catch((err: Error) => {
    // Non-blocking — audit log failure must never break the request
    logger.warn({ err: err.message, leadId, action }, "Failed to persist audit log");
  });
}

export default async function customerRoutes(fastify: FastifyInstance) {
  // ─── Send OTP to lead's phone ──────────────────────────────────
  // SECURITY: Rate limited to 5 requests per minute per IP.
  // The otpAttempts counter is NOT reset here — it persists across OTP requests
  // to prevent unlimited re-sends for brute-forcing. Only reset on successful login.
  fastify.post("/customer/auth/send-otp", {
    schema: {
      body: {
        type: "object",
        required: ["phone"],
        properties: {
          phone: { type: "string", minLength: 10 },
        },
      },
    },
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: { phone: string } }>, reply: FastifyReply) => {
    const { phone } = request.body;
    const requestId = (request as unknown as Record<string, string>).requestId || "unknown";

    // Find lead by phone (last 10 digits)
    const lead = await fastify.prisma.lead.findFirst({
      where: { phone: { contains: phone.slice(-10) } },
      include: { client: { select: { businessName: true, ownerWhatsapp: true, id: true } } },
    });

    if (!lead) {
      logger.info({ requestId, phone: phone.slice(-4), action: "otp.send.no_match" }, "OTP requested for unknown number");
      return { message: "If a booking exists with this number, an OTP has been sent." };
    }

    // SECURITY: Check if OTP attempts have been exhausted (5 failed = lockout)
    if (lead.otpAttempts >= 5) {
      logger.warn({ requestId, leadId: lead.id, attempts: lead.otpAttempts }, "OTP send blocked — too many failed attempts");
      // Don't reveal whether the number exists — return same vague message
      return { message: "If a booking exists with this number, an OTP has been sent." };
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    // Store OTP in lead record (don't reset otpAttempts — only reset on successful verify)
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { otpCode: otp, otpExpiresAt },
    });

    // Send OTP via WhatsApp (primary)
    const waSent = await sendTextMessage({
      to: lead.phone,
      text: `🔐 Your LeadBridge OTP is: ${otp}\n\nThis code expires in 10 minutes.\n\n— ${lead.client?.businessName || "LeadBridge"}`,
      recipientType: "customer",
    }).catch(() => false);

    // Fallback to SMS if WhatsApp fails
    if (!waSent) {
      await sendSms(lead.phone, `Your LeadBridge OTP: ${otp}. Valid for 10 minutes.`);
    }

    // Log the notification
    await fastify.prisma.customerNotification.create({
      data: {
        leadId: lead.id,
        type: "OTP_SENT",
        channel: waSent ? "whatsapp" : "sms",
        message: `OTP sent to ${lead.phone.slice(-4)}`,
        status: "sent",
        sentAt: new Date(),
      },
    });

    logger.info({ requestId, leadId: lead.id, via: waSent ? "whatsapp" : "sms" }, "Login OTP sent to lead");

    return { message: "If a booking exists with this number, an OTP has been sent." };
  });

  // ─── Verify OTP and return JWT ─────────────────────────────────
  // SECURITY: 
  // - OTP expires after 10 minutes (otpExpiresAt)
  // - After 5 failed attempts, the OTP is locked (otpAttempts >= 5)
  // - Rate limited to 10 requests per minute per IP
  // - All failed attempts increment otpAttempts
  // - On successful login, otpAttempts resets to 0
  fastify.post("/customer/auth/verify-otp", {
    schema: {
      body: {
        type: "object",
        required: ["phone", "otp"],
        properties: {
          phone: { type: "string", minLength: 10 },
          otp: { type: "string", minLength: 4, maxLength: 8 },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest<{ Body: { phone: string; otp: string } }>, reply: FastifyReply) => {
    const { phone, otp } = request.body;

    // First check if the phone exists and OTP attempts aren't exhausted
    const leadCheck = await fastify.prisma.lead.findFirst({
      where: { phone: { contains: phone.slice(-10) } },
      select: { id: true, otpAttempts: true },
    });

    if (leadCheck && leadCheck.otpAttempts >= 5) {
      logger.warn({ leadId: leadCheck.id, action: "otp.verify.locked" }, "OTP locked — too many failed attempts");
      return reply.status(429).send({ error: "Too many failed attempts. Please try again later." });
    }

    // Find lead with matching OTP that hasn't expired
    const lead = await fastify.prisma.lead.findFirst({
      where: {
        phone: { contains: phone.slice(-10) },
        otpCode: otp,
        otpExpiresAt: { gt: new Date() },
      },
      include: {
        client: {
          select: {
            id: true,
            businessName: true,
            ownerName: true,
            ownerWhatsapp: true,
          },
        },
        booking: {
          include: { property: true },
        },
      },
    });

    if (!lead) {
      // Increment failed attempt counter
      if (leadCheck) {
        await fastify.prisma.lead.update({
          where: { id: leadCheck.id },
          data: { otpAttempts: { increment: 1 } },
        });
        const newAttempts = leadCheck.otpAttempts + 1;
        if (newAttempts >= 5) {
          logger.warn({ leadId: leadCheck.id, attempts: newAttempts }, "OTP now locked — 5 failed attempts reached");
        }
      }

      logger.warn({ action: "otp.verify.failed", ip: request.ip }, "Invalid or expired OTP attempt");
      return reply.status(401).send({ error: "Invalid or expired OTP" });
    }

    // Generate auth token
    const authToken = crypto.randomUUID();
    const accessToken = generateAccessToken({
      sub: lead.id,
      role: "client",
      clientId: lead.clientId,
    });

    // Clear OTP, reset attempts, and store auth token
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
        authToken,
        lastLoginAt: new Date(),
      },
    });

    // Log successful OTP login
    await logCustomerAction(fastify, {
      clientId: lead.clientId,
      leadId: lead.id,
      action: "otp.verify.success",
      details: { leadName: lead.name, leadStatus: lead.status },
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "unknown",
    });

    return {
      accessToken,
      tokenType: "bearer",
      customer: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        score: lead.score,
        clientName: lead.client?.businessName || "",
        clientContact: lead.client?.ownerWhatsapp || "",
      },
      booking: lead.booking ? {
        id: lead.booking.id,
        visitDate: lead.booking.visitDate.toISOString(),
        visitTime: lead.booking.visitTime,
        propertyAddress: lead.booking.propertyAddress,
        propertyName: lead.booking.propertyName,
        property: lead.booking.property ? {
          name: lead.booking.property.name,
          description: lead.booking.property.description,
          price: lead.booking.property.price,
          bedrooms: lead.booking.property.bedrooms,
          bathrooms: lead.booking.property.bathrooms,
          area: lead.booking.property.area,
          areaUnit: lead.booking.property.areaUnit,
          amenities: lead.booking.property.amenities,
          images: lead.booking.property.images,
        } : null,
        status: lead.booking.status,
        notes: lead.booking.notes,
      } : null,
    };
  });

  // ─── Get Customer Profile & Booking ────────────────────────────
  fastify.get("/customer/profile", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest) => {
    const leadId = request.userId;

    const lead = await fastify.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        client: {
          select: {
            id: true,
            businessName: true,
            ownerName: true,
            ownerWhatsapp: true,
            phone: true,
            city: true,
          },
        },
        booking: {
          include: { property: true },
        },
        calls: {
          take: 5,
          orderBy: { createdAt: "desc" },
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
      return { customer: null, booking: null };
    }

    return {
      customer: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        score: lead.score,
        source: lead.source,
        budget: lead.budget,
        location: lead.location,
        timeline: lead.timeline,
        propertyType: lead.propertyType,
        receivedAt: lead.receivedAt,
        clientName: lead.client?.businessName || "",
        clientOwner: lead.client?.ownerName || "",
        clientContact: lead.client?.ownerWhatsapp || lead.client?.phone || "",
        clientCity: lead.client?.city || "",
      },
      booking: lead.booking ? {
        id: lead.booking.id,
        visitDate: lead.booking.visitDate.toISOString(),
        visitTime: lead.booking.visitTime,
        propertyAddress: lead.booking.propertyAddress,
        propertyName: lead.booking.propertyName,
        property: lead.booking.property ? {
          name: lead.booking.property.name,
          description: lead.booking.property.description,
          price: lead.booking.property.price,
          bedrooms: lead.booking.property.bedrooms,
          bathrooms: lead.booking.property.bathrooms,
          area: lead.booking.property.area,
          areaUnit: lead.booking.property.areaUnit,
          amenities: lead.booking.property.amenities,
          images: lead.booking.property.images,
          status: lead.booking.property.status,
        } : null,
        status: lead.booking.status,
        notes: lead.booking.notes,
        confirmedAt: lead.booking.confirmedAt,
        reminderSentAt: lead.booking.reminderSentAt,
        visitedAt: lead.booking.visitedAt,
      } : null,
      recentCalls: lead.calls || [],
    };
  });

  // ─── Reschedule Booking ────────────────────────────────────────
  fastify.patch("/customer/bookings/:id/reschedule", {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: "object",
        required: ["visitDate", "visitTime"],
        properties: {
          visitDate: { type: "string" },
          visitTime: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as { visitDate: string; visitTime: string };
    const leadId = request.userId;

    // Verify booking belongs to this lead
    const booking = await fastify.prisma.booking.findFirst({
      where: { id: params.id, lead: { id: leadId } },
      include: { lead: true, client: true },
    });

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    if (["VISITED", "CANCELLED"].includes(booking.status)) {
      return reply.status(400).send({ error: "Cannot reschedule a completed or cancelled booking" });
    }

    const newDate = new Date(body.visitDate);
    if (isNaN(newDate.getTime())) {
      return reply.status(400).send({ error: "Invalid date format" });
    }

    // Remove any pending reminder job for the old booking date
    const { cancelReminderJob, enqueueReminder } = await import("../workers/queues");
    await cancelReminderJob(booking.id).catch(() => {});

    // Update booking
    const [updated, _lead] = await Promise.all([
      fastify.prisma.booking.update({
        where: { id: booking.id },
        data: {
          visitDate: newDate,
          visitTime: body.visitTime,
          status: "RESCHEDULED",
        },
      }),
      fastify.prisma.lead.update({
        where: { id: leadId },
        data: { status: "REBOOKED" },
      }),
    ]);

    // Schedule a NEW reminder for the rescheduled date
    const newReminderTime = new Date(newDate);
    newReminderTime.setHours(9, 0, 0, 0);
    const delayMs = Math.max(0, newReminderTime.getTime() - Date.now());
    if (delayMs > 0) {
      await enqueueReminder({ leadId, clientId: booking.clientId, bookingId: booking.id }, delayMs);
    }

    // Notify broker
    await fastify.prisma.ownerNotification.create({
      data: {
        clientId: booking.clientId,
        leadId: booking.lead?.id ?? leadId,
        bookingId: booking.id,
        type: "BOOKING_RESCHEDULED",
        message: `${booking.lead?.name || "A lead"} rescheduled their visit to ${body.visitDate} at ${body.visitTime}`,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Audit log
    await logCustomerAction(fastify, {
      clientId: booking.clientId,
      leadId,
      bookingId: booking.id,
      action: "booking.rescheduled",
      details: {
        leadName: booking.lead?.name,
        oldDate: booking.visitDate.toISOString(),
        newDate: body.visitDate,
        newTime: body.visitTime,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "unknown",
    });

    return { booking: updated, message: "Visit rescheduled successfully" };
  });

  // ─── Cancel Booking ────────────────────────────────────────────
  fastify.patch("/customer/bookings/:id/cancel", {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as { reason?: string };
    const leadId = request.userId;

    const booking = await fastify.prisma.booking.findFirst({
      where: { id: params.id, lead: { id: leadId } },
      include: { lead: true, client: true },
    });

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    if (["VISITED", "CANCELLED"].includes(booking.status)) {
      return reply.status(400).send({ error: "Booking is already completed or cancelled" });
    }

    // Remove any pending reminder job from queue
    const { cancelReminderJob } = await import("../workers/queues");
    await cancelReminderJob(booking.id).catch(() => {});

    const [updated, _lead] = await Promise.all([
      fastify.prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      }),
      fastify.prisma.lead.update({
        where: { id: leadId },
        data: { status: "COLD", coldAt: new Date() },
      }),
    ]);

    // Notify broker
    await fastify.prisma.ownerNotification.create({
      data: {
        clientId: booking.clientId,
        leadId: booking.lead?.id ?? leadId,
        bookingId: booking.id,
        type: "BOOKING_CANCELLED",
        message: `${booking.lead?.name || "A lead"} cancelled their visit. Reason: ${body.reason || "Not specified"}`,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Audit log
    await logCustomerAction(fastify, {
      clientId: booking.clientId,
      leadId,
      bookingId: booking.id,
      action: "booking.cancelled",
      details: {
        leadName: booking.lead?.name,
        reason: body.reason || null,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "unknown",
    });

    return { booking: updated, message: "Visit cancelled" };
  });

  // ─── Get all bookings for this lead (full history) ────────────
  fastify.get("/customer/bookings", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const leadId = request.userId;

    const bookings = await fastify.prisma.booking.findMany({
      where: { lead: { id: leadId } },
      include: {
        property: {
          select: { name: true, price: true, bedrooms: true, images: true },
        },
      },
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    });

    const serialized = bookings.map((b) => ({
      id: b.id,
      visitDate: b.visitDate.toISOString(),
      visitTime: b.visitTime,
      propertyAddress: b.propertyAddress,
      propertyName: b.propertyName,
      notes: b.notes,
      status: b.status,
      confirmedAt: b.confirmedAt?.toISOString() || null,
      reminderSentAt: b.reminderSentAt?.toISOString() || null,
      visitedAt: b.visitedAt?.toISOString() || null,
      noShowAt: b.noShowAt?.toISOString() || null,
      property: b.property ? {
        name: b.property.name,
        price: b.property.price,
        bedrooms: b.property.bedrooms,
        images: b.property.images,
      } : null,
    }));

    return { bookings: serialized };
  });

  // ─── Confirm a booking ─────────────────────────────────────────
  fastify.patch("/customer/bookings/:id/confirm", {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const params = request.params as { id: string };
    const leadId = request.userId;

    // Verify booking belongs to this lead
    const booking = await fastify.prisma.booking.findFirst({
      where: { id: params.id, lead: { id: leadId } },
      include: { lead: true, client: true },
    });

    if (!booking) {
      return reply.status(404).send({ error: "Booking not found" });
    }

    if (["VISITED", "CANCELLED", "NO_SHOW"].includes(booking.status)) {
      return reply.status(400).send({ error: "Booking is already completed or cancelled" });
    }

    const [updated] = await Promise.all([
      fastify.prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      }),
      fastify.prisma.lead.update({
        where: { id: leadId },
        data: { status: "BOOKED" },
      }),
    ]);

    // Notify broker
    await fastify.prisma.ownerNotification.create({
      data: {
        clientId: booking.clientId,
        leadId: booking.lead?.id ?? leadId,
        bookingId: booking.id,
        type: "BOOKING_CONFIRMED",
        message: `${booking.lead?.name || "A lead"} confirmed their visit on ${booking.visitDate.toISOString().split("T")[0]} at ${booking.visitTime}`,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Audit log
    await logCustomerAction(fastify, {
      clientId: booking.clientId,
      leadId,
      bookingId: booking.id,
      action: "booking.confirmed",
      details: {
        leadName: booking.lead?.name,
        visitDate: booking.visitDate.toISOString().split("T")[0],
        visitTime: booking.visitTime,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"] || "unknown",
    });

    return { booking: updated, message: "Visit confirmed! We look forward to seeing you." };
  });

  // ─── Get WhatsApp chat history for this lead ────────────────────
  fastify.get("/customer/chat-history", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest) => {
    const leadId = request.userId;

    const messages = await fastify.prisma.customerNotification.findMany({
      where: {
        leadId,
        channel: "whatsapp",
        type: { in: ["INCOMING_WHATSAPP", "CHATBOT_REPLY", "OTP_SENT"] },
      },
      orderBy: { sentAt: "asc" },
      take: 100,
    });

    return { messages };
  });

  // ─── Get all available properties from the broker ──────────────
  fastify.get("/customer/properties", {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest) => {
    const leadId = request.userId;

    const lead = await fastify.prisma.lead.findUnique({
      where: { id: leadId },
      select: { clientId: true },
    });

    if (!lead) {
      return { properties: [] };
    }

    const properties = await fastify.prisma.property.findMany({
      where: {
        clientId: lead.clientId,
        status: "AVAILABLE",
      },
      orderBy: [{ featured: "desc" }, { name: "asc" }],
      take: 20,
    });

    return { properties };
  });
}

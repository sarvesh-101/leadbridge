import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import { generateAccessToken } from "../plugins/auth";
import { sendTextMessage } from "../services/whatsapp.service";
import { sendSms } from "../services/sms.service";
import { logger } from "../utils/logger";

export default async function customerRoutes(fastify: FastifyInstance) {
  // ─── Send OTP to lead's phone ──────────────────────────────────
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

    // Find lead by phone (last 10 digits)
    const lead = await fastify.prisma.lead.findFirst({
      where: { phone: { contains: phone.slice(-10) } },
      include: { client: { select: { businessName: true, ownerWhatsapp: true } } },
    });

    if (!lead) {
      // Don't reveal whether phone exists — always return success
      return { message: "If a booking exists with this number, an OTP has been sent." };
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

    // Store OTP in lead record
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

    logger.info({ leadId: lead.id, via: waSent ? "whatsapp" : "sms" }, "Login OTP sent to lead");

    return { message: "If a booking exists with this number, an OTP has been sent." };
  });

  // ─── Verify OTP and return JWT ─────────────────────────────────
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
      return reply.status(401).send({ error: "Invalid or expired OTP" });
    }

    // Generate auth token
    const authToken = crypto.randomUUID();
    const accessToken = generateAccessToken({
      sub: lead.id,
      role: "client",
      clientId: lead.clientId,
    });

    // Clear OTP and store auth token
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
        authToken,
        lastLoginAt: new Date(),
      },
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

    return { booking: updated, message: "Visit cancelled" };
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

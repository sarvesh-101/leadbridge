import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  enqueueCall, enqueueExtraction, enqueueNotification,
  enqueueReminder, enqueueFollowup, enqueueWebhookRetry,
} from "../../workers/queues";
import { emitStatusChange, emitBookingCreated, emitCallEnded } from "../../services/websocket.service";
import { config } from "../../config";
import { isDuplicate, markProcessed } from "../../utils/webhook-idempotency";
import { shouldRetry, getRetryDelay } from "../../utils/retry-delay";

/**
 * Omnidimension Webhook Handler — THE MOST CRITICAL FILE IN THE CODEBASE.
 * POST /api/v1/webhooks/omnidimension/call-events
 *
 * Receives call lifecycle events and routes by call_type:
 * - QUALIFICATION → booking creation or FAQ/COLD routing
 * - BOOKING_REMINDER → reminder outcome handling
 * - FOLLOWUP_D1 → lead re-engagement check
 * - FOLLOWUP_D3 → final attempt routing
 *
 * Configure this URL in the Omnidimension dashboard's Post-Call Actions.
 */
export default async function omnidimensionWebhookRoutes(fastify: FastifyInstance) {
  fastify.post("/webhooks/omnidimension/call-events", {
    config: { rateLimit: { max: 100, timeWindow: "1 minute" } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const event = request.body as Record<string, unknown>;

    const callLogId = (event.call_sid || event.call_id) as string | undefined;
    const callStatus = (event.call_status as string || "").toLowerCase();
    const duration = (event.call_duration as number) || 0;
    const callReport = event.call_report as Record<string, unknown> | undefined;
    const callContext = (event.call_context || event.custom_variables || {}) as Record<string, unknown>;

    fastify.log.info({ callLogId, callStatus }, "Omnidimension webhook received");

    if (!callLogId) {
      return reply.status(200).send({ error: "Missing call_sid" });
    }

    // ─── Idempotency check ────────────────────────────────────────
    // Skip idempotency for in-progress/ringing events (they're benign duplicates)
    if (callStatus !== "in-progress" && callStatus !== "ringing") {
      const duplicate = await isDuplicate(fastify, "omnidimension", callLogId, 3600);
      if (duplicate) {
        fastify.log.warn({ callLogId, callStatus }, "Duplicate webhook event — skipping");
        return reply.status(200).send({ received: true, duplicate: true });
      }
    }

    // Find the call record
    const call = await fastify.prisma.call.findFirst({
      where: { omnidimensionCallId: callLogId },
      include: { lead: true, client: true },
    });

    if (!call) {
      fastify.log.warn({ callLogId }, "Call record not found — enqueuing webhook retry");
      await enqueueWebhookRetry(event, 2000);
      return reply.status(200).send({ queued: true });
    }

    const lead = call.lead;
    const client = call.client;
    if (!client) {
      return reply.status(200).send({ error: "Client not found for call" });
    }

    const ext = (callReport?.extracted_variables || {}) as Record<string, string>;
    const callTypeFromContext = (callContext.call_type as string || call.type || "QUALIFICATION") as "QUALIFICATION" | "BOOKING_REMINDER" | "FOLLOWUP_D1" | "FOLLOWUP_D3";

    // ─── Handle call status transitions ──────────────────────────────
    switch (callStatus) {
      case "in-progress":
      case "ringing": {
        await fastify.prisma.call.update({
          where: { id: call.id },
          data: { status: "ANSWERED" },
        });
        return reply.status(200).send({ received: true });
      }

      case "no-answer":
      case "no_answer":
      case "busy":
      case "failed": {
        const mappedStatus = callStatus === "no-answer" || callStatus === "no_answer" ? "NO_ANSWER"
                          : callStatus === "busy" ? "BUSY" : "FAILED";

        await fastify.prisma.call.update({
          where: { id: call.id },
          data: { status: mappedStatus },
        });

        await fastify.prisma.lead.update({
          where: { id: lead.id },
          data: {
            callAttempts: { increment: 1 },
            nextRetryAt: null,
          },
        });

        const attempts = lead.callAttempts + 1;
        const maxAttempts = lead.maxAttempts || 3;

        if (shouldRetry(attempts, maxAttempts)) {
          const delayMs = getRetryDelay(attempts);
          await enqueueCall({
            leadId: lead.id,
            clientId: call.clientId,
            callType: callTypeFromContext,
            attempt: attempts + 1,
          }, delayMs);

          await fastify.prisma.lead.update({
            where: { id: lead.id },
            data: { nextRetryAt: new Date(Date.now() + delayMs) },
          });
        } else {
          // Max attempts reached — mark as NO_ANSWER
          await fastify.prisma.lead.update({
            where: { id: lead.id },
            data: { status: "NO_ANSWER" },
          });

          await enqueueNotification({
            recipient: "owner", leadId: lead.id, clientId: call.clientId,
            type: "NO_ANSWER",
            data: {
              leadName: lead.name, leadPhone: lead.phone, source: lead.source,
              dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${lead.id}`,
            },
          });

          await emitStatusChange(lead.id, "NO_ANSWER", call.clientId, { final: true });
        }

        await emitCallEnded(lead.id, call.id, mappedStatus, call.clientId);
        return reply.status(200).send({ received: true });
      }

      case "completed":
      case "success": {
        // ─── Update Call Record ─────────────────────────────────────
        const updateData: Record<string, unknown> = { status: "COMPLETED", duration };
        if (callReport) {
          if (callReport.summary) updateData.summary = callReport.summary as string;
          if (callReport.full_conversation) updateData.transcript = callReport.full_conversation as string;
          if (Object.keys(ext).length > 0) updateData.extractedData = ext;
        }

        await fastify.prisma.call.update({
          where: { id: call.id },
          data: updateData,
        });

        // ─── Update Lead qualification fields from extracted variables ─
        if (Object.keys(ext).length > 0) {
          await fastify.prisma.lead.update({
            where: { id: lead.id },
            data: {
              budget: ext.budget || lead.budget,
              location: ext.location || lead.location,
              timeline: ext.timeline || lead.timeline,
              propertyType: ext.property_type || lead.propertyType,
              bedrooms: ext.bedrooms || lead.bedrooms,
              sentiment: ext.sentiment || lead.sentiment,
              callLanguage: ext.language || lead.callLanguage,
              callAttempts: { increment: 1 },
              firstCalledAt: lead.firstCalledAt || new Date(),
            },
          });
        }

        // ─── Increment client usage ─────────────────────────────
        await fastify.prisma.client.update({
          where: { id: call.clientId },
          data: { callsThisMonth: { increment: 1 } },
        });

        // ─── Route by call type ──────────────────────────────────
        switch (callTypeFromContext) {
          case "QUALIFICATION":
            await handleQualificationOutcome(fastify, call, ext, callContext, callReport);
            break;
          case "BOOKING_REMINDER":
            await handleReminderOutcome(fastify, call, ext);
            break;
          case "FOLLOWUP_D1":
            await handleFollowupD1Outcome(fastify, call, ext, callReport);
            break;
          case "FOLLOWUP_D3":
            await handleFollowupD3Outcome(fastify, call, ext, callReport);
            break;
        }

        // ─── Enqueue extraction for DeepSeek post-call analysis ──
        await enqueueExtraction({
          callId: call.id,
          leadId: lead.id,
          clientId: call.clientId,
          transcript: (callReport?.full_conversation as string) || "",
        });

        // ─── Mark webhook as processed (idempotency) ────────────
        await markProcessed(fastify, "omnidimension", callLogId, 3600);

        // ─── Publish WebSocket event ─────────────────────────────
        const outcome = (ext.call_outcome || ext.callOutcome || "unknown") as string;
        await emitCallEnded(lead.id, call.id, outcome, call.clientId);

        return reply.status(200).send({ received: true });
      }

      default:
        fastify.log.warn({ callStatus }, "Unknown call status from Omnidimension");
        return reply.status(200).send({ received: true });
    }
  });
}

// ─── Qualification Outcome Handler ──────────────────────────────
async function handleQualificationOutcome(
  fastify: FastifyInstance,
  call: any,
  ext: Record<string, string>,
  ctx: Record<string, unknown>,
  callReport?: Record<string, unknown>,
) {
  const lead = call.lead;
  const clientId = call.clientId;
  const frontendUrl = config.FRONTEND_URL;

  const bookingRequested = ext.booking_requested === "true" || ext.bookingRequested === "true";
  const bookingDate = ext.booking_date || ext.bookingDate || null;
  const bookingTime = ext.booking_time || ext.bookingTime || null;
  const callOutcome = (ext.call_outcome || ext.callOutcome || "") as string;

  let actualStatus: string;

  if (bookingRequested && bookingDate) {
    actualStatus = "BOOKED";
    const visitDate = new Date(bookingDate);
    if (isNaN(visitDate.getTime())) {
      actualStatus = "FAQ_ONLY";
      await fastify.prisma.lead.update({
        where: { id: lead.id },
        data: { status: "FAQ_ONLY" },
      });
      await enqueueNotification({
        recipient: "owner", leadId: lead.id, clientId, type: "FAQ_ONLY",
        data: { leadName: lead.name, dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}` },
      });
      await emitStatusChange(lead.id, actualStatus, clientId, { callType: "QUALIFICATION", outcome: "faq-only" });
      return;
    }

    // ─── Interactive transaction: atomically create booking + link lead ─
    const booking = await fastify.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          clientId,
          visitDate,
          visitTime: bookingTime || "11:00 AM",
          propertyAddress: "",
          propertyName: null,
          status: "CONFIRMED",
          sourceCallId: call.id,
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "BOOKED",
          bookingId: b.id,
          bookedAt: new Date(),
          budget: ext.budget || lead.budget,
          location: ext.location || lead.location,
          timeline: ext.timeline || lead.timeline,
          propertyType: ext.property_type || lead.propertyType,
          bedrooms: ext.bedrooms || lead.bedrooms,
          sentiment: ext.sentiment || lead.sentiment,
        },
      });
      return b;
    });

    const reminderTime = new Date(visitDate);
    reminderTime.setHours(9, 0, 0, 0);
    const reminderDelay = Math.max(0, reminderTime.getTime() - Date.now());
    if (reminderDelay > 0) {
      await enqueueReminder({ leadId: lead.id, clientId, bookingId: booking.id }, reminderDelay);
    }

    await enqueueNotification({
      recipient: "customer", leadId: lead.id, clientId, type: "BOOKING_CONFIRMATION", bookingId: booking.id,
      data: {
        customerName: lead.name, propertyName: "", propertyAddress: "",
        visitDate: bookingDate, visitTime: bookingTime || "11:00 AM",
        brokerName: call.client?.ownerName || "", brokerPhone: call.client?.ownerWhatsapp || "",
        mapsLink: `https://maps.google.com/?q=${encodeURIComponent(call.client?.city || "")}`,
        businessName: call.client?.businessName || "",
      },
    });

    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "BOOKING_CONFIRMED", bookingId: booking.id,
      data: {
        leadName: lead.name, leadPhone: lead.phone, source: lead.source,
        budget: ext.budget || "Not specified", bedrooms: ext.bedrooms || "",
        propertyType: ext.property_type || "", location: ext.location || "Not specified",
        timeline: ext.timeline || "Not specified",
        visitDate: bookingDate, visitTime: bookingTime || "11:00 AM",
        sentiment: ext.sentiment || "neutral",
        aiSummary: (callReport?.summary as string) || "",
        dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}`,
      },
    });

    await emitBookingCreated(lead.id, booking.id, bookingDate, bookingTime || "11:00 AM", clientId);

  } else if (callOutcome === "faq-only" || (!bookingRequested && ext.qualified === "true")) {
    actualStatus = "FAQ_ONLY";
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { status: "FAQ_ONLY" },
    });
    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "FAQ_ONLY",
      data: {
        leadName: lead.name, leadPhone: lead.phone,
        aiSummary: (callReport?.summary as string) || "",
        dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}`,
      },
    });

  } else {
    actualStatus = "COLD";
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { status: "COLD", coldAt: new Date() },
    });
    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "COLD_LEAD",
      data: {
        leadName: lead.name, leadPhone: lead.phone, source: lead.source,
        budget: ext.budget || "Not specified",
        lastContactAt: new Date().toISOString(),
        dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}`,
      },
    });
  }

  await emitStatusChange(lead.id, actualStatus, clientId, { callType: "QUALIFICATION", outcome: callOutcome });
}

// ─── Reminder Outcome Handler ──────────────────────────────────
async function handleReminderOutcome(
  fastify: FastifyInstance,
  call: any,
  ext: Record<string, string>,
) {
  const lead = call.lead;
  const clientId = call.clientId;

  // Customer answered the reminder call — they're aware of the visit
  await fastify.prisma.lead.update({
    where: { id: lead.id },
    data: { status: "REMINDED" },
  });

  if (lead.bookingId) {
    await fastify.prisma.booking.update({
      where: { id: lead.bookingId },
      data: { status: "REMINDED", reminderSentAt: new Date() },
    });
  }

  await emitStatusChange(lead.id, "REMINDED", clientId, { callType: "BOOKING_REMINDER" });
}

// ─── Follow-up D1 Outcome Handler ──────────────────────────────
async function handleFollowupD1Outcome(
  fastify: FastifyInstance,
  call: any,
  ext: Record<string, string>,
  callReport?: Record<string, unknown>,
) {
  const lead = call.lead;
  const clientId = call.clientId;
  const frontendUrl = config.FRONTEND_URL;

  const bookingRequested = ext.booking_requested === "true" || ext.bookingRequested === "true";
  const bookingDate = ext.booking_date || ext.bookingDate || null;
  let d1Status: string;

  if (bookingRequested && bookingDate) {
    d1Status = "REBOOKED";
    const d1Booking = await fastify.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          clientId,
          visitDate: new Date(bookingDate),
          visitTime: ext.booking_time || ext.bookingTime || "11:00 AM",
          propertyAddress: "",
          status: "CONFIRMED",
          sourceCallId: call.id,
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "REBOOKED", bookingId: booking.id, bookedAt: new Date() },
      });
      return booking;
    });

    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "FOLLOWUP_D1_SENT",
      data: {
        leadName: lead.name, result: "Rebooked after D1 follow-up call!",
        dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}`,
      },
    });
  } else if (ext.qualified === "false" && !bookingRequested) {
    d1Status = "COLD";
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { status: "COLD", coldAt: new Date() },
    });
    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "FOLLOWUP_D1_SENT",
      data: { leadName: lead.name, result: "Lead not interested — marked cold", dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}` },
    });
  } else {
    d1Status = "FOLLOWUP_D1";
    const d2Delay = 24 * 3600 * 1000;
    await enqueueFollowup({ leadId: lead.id, clientId, day: 2 }, d2Delay);

    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { status: "FOLLOWUP_D1", followupD1At: new Date() },
    });

    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "FOLLOWUP_D1_SENT",
      data: {
        leadName: lead.name, result: "D1 follow-up call sent — scheduling D2 WhatsApp for tomorrow",
        dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}`,
      },
    });
  }

  await emitStatusChange(lead.id, d1Status, clientId, { callType: "FOLLOWUP_D1" });
}

// ─── Follow-up D3 Outcome Handler ──────────────────────────────
async function handleFollowupD3Outcome(
  fastify: FastifyInstance,
  call: any,
  ext: Record<string, string>,
  callReport?: Record<string, unknown>,
) {
  const lead = call.lead;
  const clientId = call.clientId;
  const frontendUrl = config.FRONTEND_URL;

  const bookingRequested = ext.booking_requested === "true" || ext.bookingRequested === "true";
  const bookingDate = ext.booking_date || ext.bookingDate || null;
  let d3Status: string;

  if (bookingRequested && bookingDate) {
    d3Status = "REBOOKED";
    // Interactive transaction — ensures booking + lead are atomically linked
    const d3Booking = await fastify.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: {
          clientId,
          visitDate: new Date(bookingDate),
          visitTime: ext.booking_time || ext.bookingTime || "11:00 AM",
          propertyAddress: "",
          status: "CONFIRMED",
          sourceCallId: call.id,
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "REBOOKED", bookingId: booking.id, bookedAt: new Date() },
      });
      return booking;
    });

    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "FOLLOWUP_D3_SENT",
      data: { leadName: lead.name, result: "Rebooked after D3 final follow-up! 🎉", dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}` },
    });
  } else {
    d3Status = "COLD";
    await fastify.prisma.lead.update({
      where: { id: lead.id },
      data: { status: "COLD", coldAt: new Date() },
    });

    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId, type: "COLD_LEAD",
      data: {
        leadName: lead.name, leadPhone: lead.phone, source: lead.source,
        budget: ext.budget || "Not specified",
        lastContactAt: new Date().toISOString(),
        dashboardLink: `${frontendUrl}/dashboard/leads/${lead.id}`,
      },
    });
  }

  await emitStatusChange(lead.id, d3Status, clientId, { callType: "FOLLOWUP_D3" });
}



import { Worker } from "bullmq";
import { LeadStatus, Prisma } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { prisma } from "../utils/prisma-shared";
import { ExtractionJob, enqueueNotification, enqueueReminder, enqueueFollowup } from "./queues";
import { extractFromTranscript } from "../services/deepseek.service";
import { emitStatusChange, emitBookingCreated } from "../services/websocket.service";
import { scoreLead } from "../services/scoring.service";

const extractionWorker = new Worker<ExtractionJob>(
  "extraction",
  async (job) => {
    const { callId, leadId, clientId, transcript } = job.data;

    const call = await prisma.call.findUnique({ where: { id: callId } });
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });

    if (!call || !lead || !client) {
      throw new Error(`Call/Lead/Client not found`);
    }

    const extractedData = await extractFromTranscript(transcript);

    await prisma.call.update({
      where: { id: callId },
      data: { extractedData: extractedData as unknown as Prisma.InputJsonValue },
    });

    // Skip booking creation if webhook handler already processed this
    // (lead already has a bookingId or status is already BOOKED)
    if (lead.bookingId || lead.status === "BOOKED" || lead.status === "REBOOKED") {
      job.log(`Lead ${leadId} already has a booking or is ${lead.status} — skipping booking creation`);

      // Still update extracted data on the call
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          budget: extractedData.budget || lead.budget,
          location: extractedData.location || lead.location,
          timeline: extractedData.timeline || lead.timeline,
          propertyType: extractedData.propertyType || lead.propertyType,
          bedrooms: extractedData.bedrooms || lead.bedrooms,
          callLanguage: extractedData.language || lead.callLanguage,
          sentiment: extractedData.sentiment || lead.sentiment,
        },
      });

      await prisma.call.update({
        where: { id: callId },
        data: { summary: extractedData.summary },
      });

      await emitStatusChange(leadId, lead.status, clientId, {
        extracted: true,
        qualified: extractedData.qualified,
        sentiment: extractedData.sentiment,
        summary: extractedData.summary,
      });

      const { score } = await scoreLead(leadId);
      return { newStatus: lead.status, bookingId: lead.bookingId, score };
    }

    let newStatus: string;
    let bookingId: string | null = null;

    if (extractedData.bookingRequested && extractedData.bookingDate) {
      newStatus = "BOOKED";

      const booking = await prisma.booking.create({
        data: {
          clientId,
          visitDate: new Date(extractedData.bookingDate),
          visitTime: extractedData.bookingTime || "11:00 AM",
          propertyAddress: "",
          propertyName: null,
          status: "CONFIRMED",
          sourceCallId: callId,
        },
      });

      bookingId = booking.id;

      await prisma.lead.update({
        where: { id: leadId },
        data: { bookingId: booking.id, bookedAt: new Date() },
      });

      const visitDate = new Date(extractedData.bookingDate);
      const reminderTime = new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate(), 9, 0, 0);
      const delayMs = Math.max(0, reminderTime.getTime() - Date.now());

      await enqueueReminder({ leadId, clientId, bookingId: booking.id }, delayMs);

      // WebSocket: emit booking created
      await emitBookingCreated(leadId, booking.id, extractedData.bookingDate, extractedData.bookingTime || "11:00 AM", clientId);

      await enqueueNotification({
        recipient: "customer", leadId, clientId, type: "BOOKING_CONFIRMATION", bookingId: booking.id,
        data: {
          customerName: lead.name, propertyName: "", propertyAddress: "",
          visitDate: extractedData.bookingDate, visitTime: extractedData.bookingTime || "11:00 AM",
          brokerName: client.ownerName, brokerPhone: client.ownerWhatsapp, mapsLink: "",
          businessName: client.businessName,
        },
      });

      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "BOOKING_CONFIRMED", bookingId: booking.id,
        data: {
          leadName: lead.name, leadPhone: lead.phone, source: lead.source,
          budget: extractedData.budget, bedrooms: extractedData.bedrooms,
          propertyType: extractedData.propertyType, location: extractedData.location || "Not specified",
          timeline: extractedData.timeline, visitDate: extractedData.bookingDate,
          visitTime: extractedData.bookingTime || "11:00 AM", sentiment: extractedData.sentiment,
          aiSummary: extractedData.summary, dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${leadId}`,
        },
      });
    } else if (extractedData.sentiment === "negative" && !extractedData.qualified) {
      newStatus = "COLD";
      await prisma.lead.update({ where: { id: leadId }, data: { coldAt: new Date() } });
      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "COLD_LEAD",
        data: {
          leadName: lead.name, leadPhone: lead.phone, source: lead.source,
          budget: extractedData.budget, lastContactAt: new Date().toISOString(),
          dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${leadId}`,
        },
      });
    } else if (extractedData.qualified) {
      newStatus = "FAQ_ONLY";
      await enqueueNotification({
        recipient: "owner", leadId, clientId, type: "FAQ_ONLY",
        data: {
          leadName: lead.name, leadPhone: lead.phone, aiSummary: extractedData.summary,
          dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${leadId}`,
        },
      });
    } else {
      newStatus = "COLD";
      await prisma.lead.update({ where: { id: leadId }, data: { coldAt: new Date() } });
    }

    // Update lead with qualification data
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus as LeadStatus,
        budget: extractedData.budget,
        location: extractedData.location,
        timeline: extractedData.timeline,
        propertyType: extractedData.propertyType,
        bedrooms: extractedData.bedrooms,
        callLanguage: extractedData.language,
        sentiment: extractedData.sentiment,
      },
    });

    // Update call summary
    await prisma.call.update({
      where: { id: callId },
      data: { summary: extractedData.summary },
    });

    // ⚡ ADVANCED: Emit WebSocket event for real-time dashboard update
    await emitStatusChange(leadId, newStatus, clientId, {
      extracted: true,
      qualified: extractedData.qualified,
      sentiment: extractedData.sentiment,
      summary: extractedData.summary,
    });

    // ⚡ ADVANCED: Calculate lead score for conversion prediction
    const { score } = await scoreLead(leadId);
    job.log(`Lead ${leadId} scored: ${score}/100, status: ${newStatus}`);

    return { newStatus, bookingId, score, qualified: extractedData.qualified, sentiment: extractedData.sentiment };
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 5,
    lockDuration: 30000,
  }
);

extractionWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error.message }, "Extraction worker job failed");
});

// Graceful shutdown — close worker only (shared Prisma disconnects in index.ts)
process.on("SIGTERM", async () => {
  await extractionWorker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await extractionWorker.close();
  process.exit(0);
});

export default extractionWorker;

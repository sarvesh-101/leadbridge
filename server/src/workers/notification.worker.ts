import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { NotificationJob } from "./queues";
import { sendTextMessage } from "../services/whatsapp.service";
import {
  bookingConfirmationCustomer,
  bookingConfirmedOwner,
  bookingReminderCustomer,
  bookingDayStatusOwner,
  noShowAlertOwner,
  followupD2WhatsAppCustomer,
  coldLeadOwner,
  followupResultOwner,
  conversionOwner,
} from "../utils/templates";

const prisma = new PrismaClient();

/**
 * NOTIFICATION Worker — selects the right message template based on type,
 * builds the message, and sends via WhatsApp Cloud API.
 */
const notificationWorker = new Worker<NotificationJob>(
  "notification",
  async (job) => {
    const { recipient, leadId, clientId, type, bookingId, data } = job.data;

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    const booking = bookingId
      ? await prisma.booking.findUnique({ where: { id: bookingId } })
      : null;

    if (!lead || !client) {
      throw new Error(`Lead or Client not found for notification`);
    }

    let messageText = "";
    let toNumber = "";
    let notificationType = "";
    let notificationChannel = "whatsapp";

    if (recipient === "customer") {
      toNumber = lead.phone;

      switch (type) {
        case "BOOKING_CONFIRMATION":
          messageText = bookingConfirmationCustomer({
            customerName: data.customerName || lead.name,
            propertyName: data.propertyName || booking?.propertyName || "",
            propertyAddress: data.propertyAddress || booking?.propertyAddress || "",
            visitDate: data.visitDate || booking?.visitDate?.toISOString().split("T")[0] || "",
            visitTime: data.visitTime || booking?.visitTime || "",
            brokerName: data.brokerName || client.ownerName,
            brokerPhone: data.brokerPhone || client.ownerWhatsapp,
            mapsLink: data.mapsLink || "",
            businessName: data.businessName || client.businessName,
          });
          notificationType = "BOOKING_CONFIRMATION";
          break;

        case "BOOKING_DAY_REMINDER":
          messageText = bookingReminderCustomer({
            customerName: lead.name,
            visitTime: data.visitTime || booking?.visitTime || "",
            propertyAddress: data.propertyAddress || booking?.propertyAddress || "",
            mapsLink: data.mapsLink || "",
            brokerName: client.ownerName,
            businessName: client.businessName,
          });
          notificationType = "REMINDER";
          break;

        case "FOLLOWUP_D2_MESSAGE":
          messageText = followupD2WhatsAppCustomer({
            location: lead.location || "your preferred area",
            businessName: client.businessName,
          });
          notificationType = "FOLLOWUP";
          break;

        default:
          messageText = data.message || "Thank you for your interest!";
          notificationType = type;
      }
    } else {
      // Owner notification
      toNumber = client.ownerWhatsapp;

      switch (type) {
        case "BOOKING_CONFIRMED":
          messageText = bookingConfirmedOwner({
            leadName: data.leadName || lead.name,
            leadPhone: data.leadPhone || lead.phone,
            source: data.source || lead.source,
            budget: data.budget || "Not specified",
            bedrooms: data.bedrooms || "",
            propertyType: data.propertyType || "",
            location: data.location || "Not specified",
            timeline: data.timeline || "Not specified",
            visitDate: data.visitDate || "",
            visitTime: data.visitTime || "",
            sentiment: data.sentiment || "neutral",
            aiSummary: data.aiSummary || "",
            dashboardLink: data.dashboardLink || "#",
          });
          notificationType = "BOOKING_CONFIRMED";
          break;

        case "BOOKING_DAY_STATUS":
          messageText = bookingDayStatusOwner({
            leadName: data.leadName || lead.name,
            visitTime: data.visitTime || "",
            reminderSentAt: data.reminderSentAt || new Date().toISOString(),
          });
          notificationType = "BOOKING_DAY_STATUS";
          break;

        case "NO_SHOW_ALERT":
          messageText = noShowAlertOwner({
            leadName: data.leadName || lead.name,
            visitTime: data.visitTime || "",
            dashboardLink: data.dashboardLink || "#",
          });
          notificationType = "NO_SHOW_ALERT";
          break;

        case "FOLLOWUP_D1_SENT":
        case "FOLLOWUP_D2_SENT":
        case "FOLLOWUP_D3_SENT": {
          const day = type === "FOLLOWUP_D1_SENT" ? 1 : type === "FOLLOWUP_D2_SENT" ? 2 : 3;
          messageText = followupResultOwner({
            leadName: data.leadName || lead.name,
            day,
            result: data.result || "Follow-up sent",
            dashboardLink: data.dashboardLink || "#",
          });
          notificationType = "FOLLOWUP_RESULT";
          break;
        }

        case "COLD_LEAD":
          messageText = coldLeadOwner({
            leadName: data.leadName || lead.name,
            leadPhone: data.leadPhone || lead.phone,
            source: data.source || lead.source,
            budget: data.budget || "Not specified",
            lastContactAt: data.lastContactAt || new Date().toISOString(),
            dashboardLink: data.dashboardLink || "#",
          });
          notificationType = "COLD_LEAD";
          break;

        case "CONVERTED":
          messageText = conversionOwner({
            leadName: data.leadName || lead.name,
            dealAmount: data.dealAmount,
            dashboardLink: data.dashboardLink || "#",
          });
          notificationType = "CONVERTED";
          break;

        default:
          messageText = data.message || JSON.stringify(data);
          notificationType = type;
      }
    }

    if (!messageText) {
      job.log(`No message template found for type: ${type}`);
      return { skipped: true, reason: "No template" };
    }

    // Send via WhatsApp
    const waMessageId = await sendTextMessage({
      to: toNumber,
      text: messageText,
      recipientType: recipient,
    });

    // Create notification record
    if (recipient === "customer") {
      await prisma.customerNotification.create({
        data: {
          leadId,
          type: notificationType,
          channel: notificationChannel,
          message: messageText,
          status: waMessageId ? "sent" : "failed",
          waMessageId: waMessageId || undefined,
          sentAt: new Date(),
        },
      });

      // Mark call as customer notified
      const lastCall = await prisma.call.findFirst({
        where: { leadId },
        orderBy: { createdAt: "desc" },
      });
      if (lastCall) {
        await prisma.call.update({
          where: { id: lastCall.id },
          data: { customerNotified: true },
        });
      }
    } else {
      await prisma.ownerNotification.create({
        data: {
          clientId,
          bookingId: bookingId || undefined,
          type: notificationType,
          message: messageText,
          status: waMessageId ? "sent" : "failed",
          waMessageId: waMessageId || undefined,
          sentAt: new Date(),
        },
      });

      // Mark call as owner notified
      const lastCall = await prisma.call.findFirst({
        where: { leadId },
        orderBy: { createdAt: "desc" },
      });
      if (lastCall) {
        await prisma.call.update({
          where: { id: lastCall.id },
          data: { ownerNotified: true },
        });
      }
    }

    return { waMessageId, type: notificationType, recipient };
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 5,
    lockDuration: 30000,
  }
);

notificationWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error.message }, "Notification worker job failed");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await notificationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await notificationWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

export default notificationWorker;

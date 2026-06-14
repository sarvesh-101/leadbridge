import { Worker } from "bullmq";
import { PrismaClient, LeadStatus } from "@prisma/client";
import { config } from "../config";
import { ReminderJob, enqueueCall, enqueueNotification } from "./queues";

const prisma = new PrismaClient();

/**
 * REMINDER Worker — fires at 9:00 AM on the booking day.
 * Sends a reminder to the customer (call or WhatsApp per client config)
 * and notifies the broker of the day's upcoming visit.
 */
const reminderWorker = new Worker<ReminderJob>(
  "reminder",
  async (job) => {
    const { leadId, clientId, bookingId } = job.data;

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const client = await prisma.client.findUnique({ where: { id: clientId } });

    if (!booking || !lead || !client) {
      throw new Error(`Booking/Lead/Client not found`);
    }

    // Skip if booking already visited or cancelled
    if (booking.status !== "CONFIRMED") {
      job.log(`Booking status is ${booking.status} — skipping reminder`);
      return { skipped: true, reason: `Booking ${booking.status}` };
    }

    // Update lead and booking status to REMINDED
    await Promise.all([
      prisma.lead.update({
        where: { id: leadId },
        data: { status: "REMINDED" as LeadStatus },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: "REMINDED", reminderSentAt: new Date() },
      }),
    ]);

    // Send customer reminder (WhatsApp for now — configurable per client)
    await enqueueNotification({
      recipient: "customer",
      leadId,
      clientId,
      type: "BOOKING_DAY_REMINDER",
      bookingId,
      data: {
        customerName: lead.name,
        visitTime: booking.visitTime,
        propertyAddress: booking.propertyAddress,
        mapsLink: "",
        brokerName: client.ownerName,
        businessName: client.businessName,
      },
    });

    // Notify owner about today's visit
    await enqueueNotification({
      recipient: "owner",
      leadId,
      clientId,
      type: "BOOKING_DAY_STATUS",
      bookingId,
      data: {
        leadName: lead.name,
        visitTime: booking.visitTime,
        reminderSentAt: new Date().toISOString(),
        dashboardLink: `${config.FRONTEND_URL}/dashboard/bookings/${bookingId}`,
      },
    });

    return {
      bookingId,
      reminded: true,
      visitDate: booking.visitDate.toISOString().split("T")[0],
      visitTime: booking.visitTime,
    };
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 5,
    lockDuration: 30000,
  }
);

reminderWorker.on("failed", (job, error) => {
  console.error(`Reminder worker job ${job?.id} failed:`, error.message);
});

export default reminderWorker;

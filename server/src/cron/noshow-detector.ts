import { PrismaClient } from "@prisma/client";
import { enqueueNotification, enqueueFollowup } from "../workers/queues";
import { emitStatusChange } from "../services/websocket.service";
import { getOptimalFollowupTiming } from "../services/smart-scheduler.service";
import { config } from "../config";

const prisma = new PrismaClient();

export async function detectNoShows(): Promise<{ processed: number }> {
  const now = new Date();
  const candidateBookings = await prisma.booking.findMany({
    where: { status: "REMINDED", visitDate: { lte: now } },
    include: { lead: true, client: true },
  });

  let processed = 0;

  for (const booking of candidateBookings) {
    const [time, modifier] = booking.visitTime.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier?.toLowerCase() === "pm" && hours !== 12) hours += 12;
    if (modifier?.toLowerCase() === "am" && hours === 12) hours = 0;

    const visitDateTime = new Date(booking.visitDate);
    visitDateTime.setHours(hours, minutes, 0, 0);

    if (now.getTime() < visitDateTime.getTime() + 2 * 60 * 60 * 1000) continue;

    const lead = booking.lead;
    const client = booking.client;
    if (!lead || !client) continue;

    await prisma.$transaction([
      prisma.lead.update({ where: { id: lead.id }, data: { status: "NO_SHOW" } }),
      prisma.booking.update({ where: { id: booking.id }, data: { status: "NO_SHOW", noShowAt: now } }),
    ]);

    await enqueueNotification({
      recipient: "owner", leadId: lead.id, clientId: client.id, type: "NO_SHOW_ALERT", bookingId: booking.id,
      data: { leadName: lead.name, visitTime: booking.visitTime, dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${lead.id}` },
    });

    await emitStatusChange(lead.id, "NO_SHOW", client.id, { bookingId: booking.id });

    // ⚡ ADVANCED: Use smart scheduler for optimal D1 timing
    const { d1Delay } = await getOptimalFollowupTiming(lead.id);
    await enqueueFollowup({ leadId: lead.id, clientId: client.id, day: 1 }, d1Delay);

    processed++;
  }

  return { processed };
}

import { enqueueNotification, enqueueFollowup } from "../workers/queues";
import { emitStatusChange } from "../services/websocket.service";
import { getOptimalFollowupTiming } from "../services/smart-scheduler.service";
import { config } from "../config";
import { prisma } from "../utils/prisma-shared";

export async function detectNoShows(): Promise<{ processed: number }> {
  const now = new Date();
  const candidateBookings = await prisma.booking.findMany({
    where: { status: "REMINDED", visitDate: { lte: now } },
    include: { lead: true, client: true },
  });

  let processed = 0;

  for (const booking of candidateBookings) {
    // Parse visit time — supports both 12h ("10:00 AM") and 24h ("14:00") formats
    let hours: number;
    let minutes: number;
    const timeParts = booking.visitTime.trim();
    const amPmMatch = timeParts.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
    if (amPmMatch) {
      hours = parseInt(amPmMatch[1], 10);
      minutes = parseInt(amPmMatch[2], 10);
      const modifier = amPmMatch[3];
      if (modifier?.toUpperCase() === "PM" && hours !== 12) hours += 12;
      if (modifier?.toUpperCase() === "AM" && hours === 12) hours = 0;
      // If no AM/PM modifier and hours <= 12, assume 24h format (already correct)
    } else {
      // Fallback: try raw split
      const [h, m] = timeParts.split(":").map(Number);
      hours = h || 10;
      minutes = m || 0;
    }

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

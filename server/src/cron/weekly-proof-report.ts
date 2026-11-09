/**
 * V2 (T11) — weekly broker proof report.
 *
 * Runs Monday 09:00 IST (cron `0 9 * * 1`), computes the previous 7 days'
 * metrics for every serviceable client, stores a WeeklyBrokerMetric snapshot
 * and sends the summary. WhatsApp template when WHATSAPP_TEMPLATE_WEEKLY_REPORT
 * is configured, email otherwise.
 */
import { prisma } from "../utils/prisma-shared";
import { config } from "../config";
import { logger } from "../utils/logger";
import { sendEmail } from "../services/email.service";
import { computeProofMetrics, weekStartFor } from "../services/proof-metrics";
import { monthlyCharged } from "../config/plans";

const DAY = 24 * 60 * 60 * 1000;

function formatMetrics(m: ReturnType<typeof computeProofMetrics>): string {
  const delay = m.medianFirstCallSeconds === null ? "n/a" : `${m.medianFirstCallSeconds}s`;
  return [
    `Leads received: ${m.leadsReceived}`,
    `Median time to first call: ${delay}`,
    `Reach rate: ${Math.round(m.reachRate * 100)}%`,
    `Qualified rate: ${Math.round(m.qualifiedRate * 100)}%`,
    `Site visits booked: ${m.visitsBooked}`,
    `Site visits completed: ${m.visitsCompleted}`,
    `Cost per completed visit: ${m.costPerCompletedVisit === "n/a" ? "n/a" : `Rs ${m.costPerCompletedVisit}`}`,
  ].join("\n");
}

export async function runWeeklyProofReport(now = new Date()): Promise<{ clients: number; sent: number; failed: number }> {
  const to = now;
  const from = new Date(to.getTime() - 7 * DAY);
  const weekStart = weekStartFor(from);

  const clients = await prisma.client.findMany({
    where: { planStatus: { in: ["TRIAL", "ACTIVE"] } },
    select: { id: true, businessName: true, email: true, ownerWhatsapp: true, plan: true },
  });

  let sent = 0;
  let failed = 0;

  for (const client of clients) {
    try {
      const [leads, bookings] = await Promise.all([
        prisma.lead.findMany({
          where: { clientId: client.id, receivedAt: { gte: from, lte: to } },
          select: {
            id: true, receivedAt: true, firstCallDelaySeconds: true, status: true,
            budget: true, location: true, propertyType: true, timeline: true,
            calls: { select: { status: true, createdAt: true } },
          },
        }),
        prisma.booking.findMany({
          where: { clientId: client.id, visitDate: { gte: from, lte: to } },
          select: { visitDate: true, status: true },
        }),
      ]);

      const planCharged = monthlyCharged(client.plan === "LAUNCH" ? "STARTER" : (client.plan as "STARTER" | "GROWTH" | "PRO"));
      const metrics = computeProofMetrics(leads, bookings, { from, to }, planCharged);
      // The DB column is nullable float; the API-facing metric uses "n/a".
      const snapshot = {
        leadsReceived: metrics.leadsReceived,
        medianFirstCallSeconds: metrics.medianFirstCallSeconds,
        reachRate: metrics.reachRate,
        qualifiedRate: metrics.qualifiedRate,
        visitsBooked: metrics.visitsBooked,
        visitsCompleted: metrics.visitsCompleted,
        costPerCompletedVisit:
          metrics.costPerCompletedVisit === "n/a" ? null : metrics.costPerCompletedVisit,
      };

      await prisma.weeklyBrokerMetric.upsert({
        where: { clientId_weekStart: { clientId: client.id, weekStart } },
        create: { clientId: client.id, weekStart, weekEnd: to, ...snapshot },
        update: { weekEnd: to, ...snapshot },
      });

      const body = `Your Converza week\n\n${formatMetrics(metrics)}\n\nQuestions? Reply to this email.`;
      let delivered = false;

      if (config.WHATSAPP_TEMPLATE_WEEKLY_REPORT) {
        try {
          const { sendTextMessage } = await import("../services/whatsapp.service");
          const id = await sendTextMessage({ to: client.ownerWhatsapp, text: body, recipientType: "owner" });
          delivered = Boolean(id);
        } catch (err: any) {
          logger.warn({ clientId: client.id, err: err.message }, "Weekly report: WhatsApp failed, falling back to email");
        }
      }

      if (!delivered) {
        delivered = await sendEmail({
          to: client.email,
          subject: `Your Converza week — ${metrics.leadsReceived} leads, ${metrics.visitsBooked} visits booked`,
          text: body,
        });
      }

      delivered ? sent++ : failed++;
    } catch (err: any) {
      failed++;
      logger.error({ clientId: client.id, err: err.message }, "Weekly report: client failed");
    }
  }

  logger.info({ clients: clients.length, sent, failed }, "Weekly proof report complete");
  return { clients: clients.length, sent, failed };
}

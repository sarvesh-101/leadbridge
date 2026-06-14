import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

/**
 * Monthly Report Generator — runs on the 1st of every month at 6:00 AM.
 *
 * For each active client:
 * 1. Aggregates previous month's stats (leads, calls, bookings, conversions)
 * 2. Resets callsThisMonth counter
 * 3. Sends email with report summary via Resend
 */
export async function generateMonthlyReports(): Promise<{ reportsGenerated: number }> {
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const activeClients = await prisma.client.findMany({
    where: {
      planStatus: { in: ["TRIAL", "ACTIVE"] },
    },
  });

  let reportsGenerated = 0;

  for (const client of activeClients) {
    const [totalLeads, totalCalls, totalBookings, conversions] = await Promise.all([
      prisma.lead.count({
        where: { clientId: client.id, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.call.count({
        where: { clientId: client.id, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.booking.count({
        where: { clientId: client.id, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
      prisma.lead.count({
        where: { clientId: client.id, status: "CONVERTED", convertedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      }),
    ]);

    // Reset monthly call counter
    await prisma.client.update({
      where: { id: client.id },
      data: { callsThisMonth: 0 },
    });

    const month = `${lastMonthStart.getMonth() + 1}/${lastMonthStart.getFullYear()}`;
    const conversionRate = totalLeads > 0 ? Math.round((conversions / totalLeads) * 100) : 0;

    // Build report text
    const reportText = [
      `Hi ${client.ownerName},`,
      ``,
      `Here's your LeadBridge performance report for ${month}:`,
      ``,
      `📊 Monthly Summary`,
      `━━━━━━━━━━━━━━━━`,
      `• Leads received: ${totalLeads}`,
      `• AI calls made: ${totalCalls}`,
      `• Visits booked: ${totalBookings}`,
      `• Deals closed: ${conversions}`,
      `• Conversion rate: ${conversionRate}%`,
      ``,
      `🏆 Key Highlights`,
      `━━━━━━━━━━━━━━━━`,
      totalLeads > 0
        ? `• ${Math.round(totalBookings / totalLeads * 100)}% of leads converted to visits`
        : `• Start receiving leads to see your stats!`,
      conversions > 0
        ? `• Closed ${conversions} deal(s) this month`
        : `• Focus on converting your booked visits`,
      ``,
      `💡 Tip: Respond to WhatsApp messages quickly to improve conversion rates.`,
      ``,
      `View full analytics: ${config.FRONTEND_URL}/dashboard/analytics`,
      ``,
      `— The LeadBridge Team`,
    ].join("\n");

    // Send email via Resend
    try {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `LeadBridge Reports <${config.FROM_EMAIL}>`,
          to: [client.email],
          subject: `📊 LeadBridge Monthly Report — ${month}`,
          text: reportText,
        }),
      });

      if (emailResponse.ok) {
        logger.info({ clientId: client.id, month }, "Monthly report email sent");
      } else {
        const err = await emailResponse.text();
        logger.error({ clientId: client.id, err }, "Failed to send monthly report email");
      }
    } catch (error: any) {
      logger.error({ err: error.message, clientId: client.id }, "Failed to send monthly report email");
    }

    reportsGenerated++;
  }

  return { reportsGenerated };
}

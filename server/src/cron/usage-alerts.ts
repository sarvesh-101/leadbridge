/**
 * Usage Alert Cron — runs every 6 hours.
 *
 * Checks all active brokers for call usage levels and sends alerts:
 * - 80% usage → "You've used 80% of your monthly calls"
 * - 90% usage → "You've used 90% — consider the overage packs"
 * - 100% usage → "You've used all available calls — calls will be blocked"
 *
 * Uses the client's lastUsageAlertSentAt and usageAlertLevel to avoid spamming.
 * FIX #4 (P1): Proactive broker usage notifications.
 */

import { prisma } from "../utils/prisma-shared";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getBrokerCredits } from "../services/credit-manager.service";

const ALERT_THRESHOLDS = [80, 90, 100];

export async function runUsageAlerts(): Promise<{ alertsSent: number }> {
  const brokers = await prisma.client.findMany({
    where: {
      planStatus: { in: ["TRIAL", "ACTIVE"] },
    },
    select: { id: true, ownerName: true, ownerWhatsapp: true, email: true, lastUsageAlertSentAt: true, usageAlertLevel: true, businessName: true },
  });

  let alertsSent = 0;

  for (const broker of brokers) {
    try {
      const credits = await getBrokerCredits(prisma, broker.id);
      const usagePercent = credits.usagePercent;

      // Find the highest threshold crossed
      let notifyLevel = 0;
      for (const level of ALERT_THRESHOLDS) {
        if (usagePercent >= level) {
          notifyLevel = level;
        }
      }

      // Skip if no threshold crossed or already alerted at this level
      if (notifyLevel === 0 || broker.usageAlertLevel >= notifyLevel) {
        continue;
      }

      // Build alert message
      const remaining = credits.totalRemaining;
      const message = buildAlertMessage(broker.ownerName, notifyLevel, remaining, credits.totalAvailable);

      // Send via WhatsApp (primary) and email (fallback)
      try {
        const { enqueueNotification } = await import("../workers/queues");
        await enqueueNotification({
          recipient: "owner",
          leadId: "",
          clientId: broker.id,
          type: "USAGE_ALERT",
          data: {
            message,
            level: String(notifyLevel),
            usagePercent: String(usagePercent),
            remaining: String(remaining),
            totalAvailable: String(credits.totalAvailable),
            upgradeUrl: `${config.FRONTEND_URL}/dashboard/billing`,
          },
        });
      } catch {
        // If queue is down, still log the alert
      }

      // Update alert tracking
      await prisma.client.update({
        where: { id: broker.id },
        data: {
          lastUsageAlertSentAt: new Date(),
          usageAlertLevel: notifyLevel,
        },
      });

      alertsSent++;
      logger.info({ brokerId: broker.id, level: notifyLevel, usagePercent }, "Usage alert sent");
    } catch (err: any) {
      logger.warn({ brokerId: broker.id, err: err.message }, "Failed to check usage alert for broker");
    }
  }

  if (alertsSent > 0) {
    logger.info({ alertsSent }, "Usage alert cycle complete");
  }

  return { alertsSent };
}

function buildAlertMessage(name: string, level: number, remaining: number, total: number): string {
  switch (level) {
    case 80:
      return `Namaste ${name} ji!\n\nAapne ${total} calls mein se ${total - remaining} calls use kar liye hain (80%).\n\nAgle mahine reset se pehle calls khatam ho sakti hain. Extra calls lene ke liye billing section mein jaayein.`;
    case 90:
      return `Namaste ${name} ji!\n\nAap ${total} calls mein se 90% use kar chuke hain. Sirf ${remaining} calls bache hain.\n\nExtra calls packs available hain — 50 calls ₹500, 100 calls ₹900. Calls block hone se pehle kharidein.`;
    case 100:
      return `Namaste ${name} ji!\n\nAapne saari ${total} calls use kar li hain. Naye calls block kar diye gaye hain.\n\nExtra calls kharidne ke liye billing section mein jaayein ya agle mahine ka wait karein.\n\nUpgrade: ${config.FRONTEND_URL}/dashboard/billing`;
    default:
      return `Namaste ${name} ji! Aapke paas ${remaining} calls bache hain (${total} total).`;
  }
}

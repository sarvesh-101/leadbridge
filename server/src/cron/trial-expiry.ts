import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { sendEmail } from "../services/email.service";

const prisma = new PrismaClient();

/**
 * Trial Expiry Checker — runs daily at 8:00 AM.
 *
 * Finds clients where:
 * - planStatus = TRIAL
 * - trialEndsAt < now()
 *
 * For each match:
 * 1. Sets planStatus = PAST_DUE (stops processing new leads)
 * 2. Sends trial expiry email via SMTP (Nodemailer)
 */
export async function checkTrialExpiry(): Promise<{ paused: number; emailsSent: number }> {
  const now = new Date();

  const expiredTrials = await prisma.client.findMany({
    where: {
      planStatus: "TRIAL",
      trialEndsAt: { lte: now },
    },
  });

  let paused = 0;
  let emailsSent = 0;

  for (const client of expiredTrials) {
    // Pause the account
    await prisma.client.update({
      where: { id: client.id },
      data: { planStatus: "PAST_DUE" },
    });

    paused++;

    // Send trial expiry email via shared email service (SMTP via Nodemailer)
    try {
      const emailSent = await sendEmail({
        to: client.email,
        subject: "Your LeadBridge trial has expired — upgrade to continue",
        text: `Hi ${client.ownerName},

Your LeadBridge trial period has ended.

To continue receiving and managing AI-called leads, please upgrade to a paid plan.

Here's what you get with Growth plan (₹35,000/month):
• 300 AI calls per month
• WhatsApp notifications
• Territory exclusivity
• Daily follow-up sequences

Upgrade here: ${config.FRONTEND_URL}/dashboard/billing

Questions? Reply to this email.

— The LeadBridge Team`,
      });

      if (emailSent) {
        emailsSent++;
        logger.info({ clientId: client.id, email: client.email }, "Trial expiry email sent");
      } else {
        logger.error({ clientId: client.id }, "Failed to send trial expiry email");
      }
    } catch (error: any) {
      logger.error({ err: error.message, clientId: client.id }, "Failed to send trial expiry email");
    }
  }

  return { paused, emailsSent };
}

import { config } from "../config";
import { logger } from "../utils/logger";
import { sendEmail } from "../services/email.service";
import { prisma } from "../utils/prisma-shared";

/**
 * Trial Expiry Checker — runs daily at 8:00 AM.
 *
 * ENFORCEMENT CHAIN:
 *   1. This cron sets planStatus = PAST_DUE when trial expires
 *   2. The call.worker.ts checks planStatus !== "TRIAL" || !== "ACTIVE" → blocks calls
 *   3. The lead ingestion webhook also checks planStatus → blocks new leads
 *   4. An email is sent to the broker asking them to upgrade
 *
 * For each match:
 * 1. Sets planStatus = PAST_DUE (stops processing new leads AND blocks AI calls via worker)
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
    // Pause the account — this triggers the call.worker.ts enforcement chain
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
• 500 AI calls per month
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

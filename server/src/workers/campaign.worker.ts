/**
 * Email Campaign Worker — processes campaign emails asynchronously via BullMQ.
 *
 * This prevents the HTTP request from blocking while sending 1000+ emails.
 * Emails are sent through the shared sendEmail() which uses SMTP (primary)
 * and falls back to Resend only if SMTP is not configured.
 *
 * Tracking:
 * - Injects a 1x1 tracking pixel for open detection
 * - Rewrites links to go through the click tracking redirect
 */

import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { sendEmail } from "../services/email.service";
import { checkABTestWinner } from "../services/email-campaign.service";
import { CampaignEmailJob, CampaignWinnerCheckJob, closeAllQueues } from "./queues";

const prisma = new PrismaClient();

/** 1x1 transparent GIF pixel (base64) */
const TRACKING_PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Inject tracking pixel and click tracking into the email HTML.
 */
function injectTracking(html: string, campaignId: string, leadId: string, leadName: string): string {
  const baseUrl = config.FRONTEND_URL.replace(/\/+$/, "");

  // Rewrite links for click tracking
  const trackedHtml = html.replace(
    /<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi,
    (_match, before, url, after) => {
      const encodedUrl = encodeURIComponent(url);
      const trackUrl = `${baseUrl}/api/v1/track/click/${campaignId}/${leadId}?url=${encodedUrl}`;
      return `<a ${before}href="${trackUrl}"${after}>`;
    }
  );

  // Append tracking pixel
  const pixelUrl = `${baseUrl}/api/v1/track/open/${campaignId}/${leadId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;

  return trackedHtml + pixel;
}

/**
 * Winner Check Worker — handles delayed A/B test winner checks.
 * Runs on the same queue name so it shares the same Redis stream.
 */
const winnerCheckWorker = new Worker<CampaignWinnerCheckJob>(
  "email-campaign",
  async (job) => {
    const { campaignId } = job.data;
    logger.info({ campaignId }, "A/B test winner check triggered");

    try {
      const result = await checkABTestWinner(campaignId);
      if (result) {
        logger.info({ campaignId, ...result }, "A/B test winner check completed");
        return result;
      }
      return { skipped: true };
    } catch (error: any) {
      logger.error({ err: error.message, campaignId }, "A/B test winner check failed");
      throw error;
    }
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 2,
    lockDuration: 30000,
  }
);

winnerCheckWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error.message }, "Winner check worker job failed");
});

const campaignWorker = new Worker<CampaignEmailJob>(
  "email-campaign",
  async (job) => {
    const { campaignId, clientId, leadId, leadName, leadEmail, location, businessName, subject, body } = job.data;

    // Replace template variables
    const html = injectTracking(
      body
        .replace(/\{\{leadName\}\}/g, leadName)
        .replace(/\{\{location\}\}/g, location || "your area")
        .replace(/\{\{businessName\}\}/g, businessName)
        .replace(/\{\{dashboardUrl\}\}/g, config.FRONTEND_URL + "/customer/dashboard"),
      campaignId,
      leadId,
      leadName
    );

    const text = `Hi ${leadName},\n\n${body.replace(/<[^>]*>/g, "")}`;

    try {
      const emailSent = await sendEmail({
        to: leadEmail,
        subject,
        text,
        html,
      });

      // Use a transaction to atomically increment + check completion
      await prisma.$transaction(async (tx) => {
        const field = emailSent ? "deliveredCount" : "failedCount";
        await tx.emailCampaign.update({
          where: { id: campaignId },
          data: { [field]: { increment: 1 } },
        });

        // Check if campaign is fully processed
        const updated = await tx.emailCampaign.findUnique({
          where: { id: campaignId },
          select: { deliveredCount: true, failedCount: true, totalRecipients: true, status: true },
        });
        if (updated && updated.status === "SENDING" && (updated.deliveredCount + updated.failedCount) >= updated.totalRecipients) {
          await tx.emailCampaign.update({
            where: { id: campaignId },
            data: { status: "SENT", sentAt: new Date() },
          });
          logger.info({ campaignId }, "Campaign fully processed — marked as SENT");

          // Send campaign completion email to the client owner
          const campaignRecord = await tx.emailCampaign.findUnique({
            where: { id: campaignId },
            select: { clientId: true, name: true, deliveredCount: true, failedCount: true, totalRecipients: true },
          });
          if (campaignRecord) {
            const client = await tx.client.findUnique({
              where: { id: campaignRecord.clientId },
              select: { email: true, ownerName: true },
            });
            if (client?.email) {
              sendEmail({
                to: client.email,
                subject: `✅ Campaign "${campaignRecord.name}" sent successfully`,
                text: `Hi ${client.ownerName},\n\nYour email campaign "${campaignRecord.name}" has finished sending.\n\n📊 Summary:\n• Recipients: ${campaignRecord.totalRecipients}\n• Delivered: ${campaignRecord.deliveredCount}\n• Failed: ${campaignRecord.failedCount}\n\nView results: ${config.FRONTEND_URL}/dashboard/campaigns/email\n\n— LeadBridge`,
              }).catch((err: any) => {
                logger.error({ err: err.message, campaignId }, "Failed to send campaign completion email");
              });
            }
          }
        }
      });

      if (emailSent) {
        await prisma.customerNotification.create({
          data: {
            leadId,
            type: "EMAIL_CAMPAIGN",
            channel: "email",
            message: `Sent: ${subject}`,
            status: "sent",
            sentAt: new Date(),
          },
        });
        logger.info({ campaignId, leadId, email: leadEmail }, "Campaign email sent");
        return { sent: true };
      } else {
        logger.warn({ campaignId, leadId, email: leadEmail }, "Campaign email failed to send");
        return { sent: false };
      }
    } catch (error: any) {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { failedCount: { increment: 1 } },
      });

      logger.error({ err: error.message, campaignId, leadId }, "Campaign email worker error");
      throw error; // BullMQ will retry
    }
  },
  {
    connection: { url: config.REDIS_URL, maxRetriesPerRequest: null },
    concurrency: 10,
    lockDuration: 30000,
  }
);

campaignWorker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, err: error.message }, "Campaign worker job failed");
});

// Graceful shutdown
async function shutdown() {
  await campaignWorker.close();
  await winnerCheckWorker.close();
  await closeAllQueues();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { campaignWorker, winnerCheckWorker };
export default campaignWorker;

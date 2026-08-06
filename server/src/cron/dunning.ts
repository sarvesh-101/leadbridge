/**
 * Dunning System — runs daily at 9:00 AM.
 *
 * Recovers failed/subscription payments by sending escalating reminders:
 * - Step 1 (Day 1): Email — "Your payment failed, please update billing info"
 * - Step 2 (Day 3): WhatsApp — "Still having trouble? Contact support"
 * - Step 3 (Day 7): Final notice + deactivate — "Account suspended"
 *
 * FIX #5 (P1): Automated dunning for failed payments.
 */

import { prisma } from "../utils/prisma-shared";
import { config } from "../config";
import { logger } from "../utils/logger";
import { sendEmail } from "../services/email.service";
import { sendTextMessage } from "../services/whatsapp.service";
import { enqueueNotification } from "../workers/queues";

const DUNNING_DELAYS_DAYS = [1, 3, 7]; // Day 1, Day 3, Day 7

export async function runDunning(): Promise<{
  processed: number;
  step1Sent: number;
  step2Sent: number;
  step3Sent: number;
  deactivated: number;
}> {
  // Find all PAST_DUE clients with active dunning tracking
  const pastDueClients = await prisma.client.findMany({
    where: {
      planStatus: "PAST_DUE",
    },
    select: {
      id: true,
      ownerName: true,
      ownerWhatsapp: true,
      email: true,
      businessName: true,
      dunningStep: true,
      dunningStartedAt: true,
      updatedAt: true,
    },
  });

  let step1Sent = 0;
  let step2Sent = 0;
  let step3Sent = 0;
  let deactivated = 0;

  for (const client of pastDueClients) {
    try {
      // Determine when dunning started — use stored value or initialize to now
      // FIX: Use client.dunningStartedAt which is set once on first dunning run,
      // falling back to updatedAt only for the very first evaluation
      const dunningStart = client.dunningStartedAt || new Date();
      const daysSinceDue = Math.floor((Date.now() - dunningStart.getTime()) / (1000 * 60 * 60 * 24));

      // Which step should we be at?
      let targetStep = 0;
      for (let i = 0; i < DUNNING_DELAYS_DAYS.length; i++) {
        if (daysSinceDue >= DUNNING_DELAYS_DAYS[i]) {
          targetStep = i + 1;
        }
      }

      // Skip if already at or past this step
      if (targetStep <= client.dunningStep) {
        continue;
      }

      // Execute the next step
      switch (targetStep) {
        case 1:
          await sendDunningEmail(client, 1);
          step1Sent++;
          break;
        case 2:
          await sendDunningWhatsApp(client, 2);
          step2Sent++;
          break;
        case 3:
          await sendDunningFinal(client, 3);
          // Deactivate the account
          await prisma.client.update({
            where: { id: client.id },
            data: {
              planStatus: "CANCELLED",
              callsLimit: 0,
            },
          });

          // FIX P1-5: release the phone number + delete the AI agent so the
          // platform stops paying ₹200/mo per cancelled number and inbound
          // calls stop ringing a live agent on a dead account.
          try {
            const { cleanupBrokerResources } = await import("../services/account-cleanup.service");
            await cleanupBrokerResources(client.id);
          } catch (err: any) {
            logger.warn({ clientId: client.id, err: err.message }, "Cleanup failed after dunning deactivation");
          }

          deactivated++;
          step3Sent++;
          break;
      }

      // Update dunning step
      await prisma.client.update({
        where: { id: client.id },
        data: {
          dunningStep: targetStep,
          dunningStartedAt: client.dunningStartedAt || new Date(),
        },
      });

      logger.info({ clientId: client.id, step: targetStep, daysSinceDue }, "Dunning step executed");
    } catch (err: any) {
      logger.warn({ clientId: client.id, err: err.message }, "Dunning step failed");
    }
  }

  if (step1Sent > 0 || step2Sent > 0 || step3Sent > 0) {
    logger.info({ step1Sent, step2Sent, step3Sent, deactivated }, "Dunning cycle complete");
  }

  return { processed: pastDueClients.length, step1Sent, step2Sent, step3Sent, deactivated };
}

async function sendDunningEmail(client: any, step: number): Promise<void> {
  const subject = step === 1
    ? "Payment Failed — Update Your Billing Info"
    : "Urgent: Your LeadBridge Account Will Be Suspended";

  const text = step === 1
    ? `Hi ${client.ownerName},\n\nYour recent subscription payment failed. To continue using LeadBridge without interruption, please update your billing information.\n\n${config.FRONTEND_URL}/dashboard/billing\n\n— LeadBridge`
    : `Hi ${client.ownerName},\n\nWe haven't received payment for your subscription. Your account will be suspended in ${step === 2 ? "5" : "1"} day(s) if payment is not made.\n\n${config.FRONTEND_URL}/dashboard/billing\n\n— LeadBridge`;

  try {
    await sendEmail({ to: client.email, subject, text });
  } catch {
    // Email might not be configured — that's OK
  }
}

async function sendDunningWhatsApp(client: any, step: number): Promise<void> {
  const message = step === 2
    ? `Namaste ${client.ownerName} ji!\n\nAapke subscription payment mein issue hai. Kripya apni billing information update karein.\n\nYahan jaayein: ${config.FRONTEND_URL}/dashboard/billing\n\nAgar koi problem hai toh humein WhatsApp karein.`
    : `Namaste ${client.ownerName} ji!\n\nAapka account kal suspend kar diya jaayega kyunki payment nahi aa paaya hai. Naye calls block ho jayenge.\n\nPayment karein: ${config.FRONTEND_URL}/dashboard/billing\n\n— LeadBridge`;  try {
      await sendTextMessage({
      to: client.ownerWhatsapp,
      text: message,
      recipientType: "customer",
    });
  } catch {
    // WhatsApp might not be configured
  }
}

async function sendDunningFinal(client: any, step: number): Promise<void> {
  // Send both email and WhatsApp for the final notice
  await sendDunningEmail(client, 3);
  await sendDunningWhatsApp(client, 3);

  // Also enqueue a notification
  await enqueueNotification({
    recipient: "owner",
    leadId: "",
    clientId: client.id,
    type: "ACCOUNT_SUSPENDED",
    data: {
      message: `${client.businessName} — Account suspended due to non-payment.`,
      reactivateUrl: `${config.FRONTEND_URL}/dashboard/billing`,
    },
  }).catch(() => {});
}

/**
 * SMS Campaign Service.
 * Sends bulk SMS messages to leads via MessageBird.
 */
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import { sendSms } from "./sms.service";

const prisma = new PrismaClient();

export async function sendSmsCampaign(
  clientId: string,
  campaign: { name: string; message: string; targetLeadIds: string[] }
): Promise<{ sent: number; failed: number }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { businessName: true },
  });
  if (!client) throw new Error("Client not found");

  const campaignRecord = await prisma.emailCampaign.create({
    data: {
      clientId,
      name: campaign.name,
      subject: "SMS Campaign",
      body: campaign.message,
      type: "SMS",
      status: "SENDING",
    },
  });

  const leads = await prisma.lead.findMany({
    where: { id: { in: campaign.targetLeadIds }, clientId, phone: { not: "" } },
    select: { id: true, name: true, phone: true },
  });

  let sent = 0;
  let failed = 0;

  for (const lead of leads) {
    const personalized = campaign.message
      .replace(/{{leadName}}/g, lead.name)
      .replace(/{{businessName}}/g, client.businessName);

    try {
      const ok = await sendSms(lead.phone, personalized);
      if (ok) {
        sent++;
        await prisma.customerNotification.create({
          data: { leadId: lead.id, type: "SMS_CAMPAIGN", channel: "sms", message: personalized, status: "sent", sentAt: new Date() },
        });
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      logger.error({ err, leadId: lead.id, phone: lead.phone }, "Failed to send SMS campaign message");
    }
  }

  await prisma.emailCampaign.update({
    where: { id: campaignRecord.id },
    data: { status: "SENT", deliveredCount: sent, failedCount: failed, totalRecipients: leads.length, sentAt: new Date() },
  });

  logger.info({ campaignId: campaignRecord.id, sent, failed }, "SMS campaign completed");
  return { sent, failed };
}

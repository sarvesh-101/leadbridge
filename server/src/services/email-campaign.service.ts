/**
 * Email Marketing Campaign Service.
 *
 * Enables brokers to create and send email campaigns to leads.
 * Uses BullMQ queue for async processing (non-blocking for bulk sends).
 * Emails are sent through shared sendEmail() which prefers SMTP.
 * Includes open/click tracking via tracking pixel and link rewriting.
 * Supports scheduling (delayed sends) and A/B testing (variant winner selection).
 */

import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { enqueueCampaignEmail, enqueueCampaignWinnerCheck } from "../workers/queues";

const prisma = new PrismaClient();

const DEFAULT_TEMPLATES = [
  {
    name: "New Property Alert",
    subject: "New properties matching your requirements",
    body: `<div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
<h1 style="color: #1a1a2e;">New Properties Available!</h1>
<p>Hi {{leadName}},</p>
<p>We have new properties that match your interest in {{location}}.</p>
<p>View them here: <a href="{{dashboardUrl}}">Browse Properties</a></p>
<br/><p>— {{businessName}}</p></div>`,
  },
  {
    name: "Follow-up Reminder",
    subject: "Still interested in property?",
    body: `<div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
<h1 style="color: #1a1a2e;">Just checking in!</h1>
<p>Hi {{leadName}},</p>
<p>We haven't heard from you recently. Are you still looking for a property in {{location}}?</p>
<p>Reply to this email or WhatsApp us to schedule a visit.</p>
<br/><p>— {{businessName}}</p></div>`,
  },
  {
    name: "Exclusive Offer",
    subject: "Special offer just for you!",
    body: `<div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
<h1 style="color: #1a1a2e;">Exclusive Offer</h1>
<p>Hi {{leadName}},</p>
<p>As a valued lead, we're pleased to offer you an exclusive deal on properties in {{location}}.</p>
<p><strong>Limited time offer — contact us today!</strong></p>
<br/><p>— {{businessName}}</p></div>`,
  },
];

interface ABTestData {
  variantSubject: string;
  variantBody: string;
  sampleSize: number;
  status: "PENDING" | "TESTING" | "WINNER_SELECTED" | "SENDING_WINNER" | "COMPLETED";
  winner: "A" | "B" | null;
  aSampleLeadIds: string[];
  bSampleLeadIds: string[];
  holdoutLeadIds: string[];
  aOpens: number;
  bOpens: number;
  aSent: number;
  bSent: number;
  winnerCheckAt: string | null;
}

type LeadWithEmail = { id: string; name: string; email: string; location: string | null };

/**
 * Get all available email templates.
 */
export function getTemplates() {
  return DEFAULT_TEMPLATES;
}

/**
 * Shuffle an array (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Enqueue a batch of emails with an optional delay.
 */
async function enqueueBatch(
  leads: LeadWithEmail[],
  campaignId: string,
  clientId: string,
  businessName: string,
  subject: string,
  body: string,
  delayMs: number = 0
): Promise<number> {
  let queued = 0;
  for (const lead of leads) {
    if (!lead.email) continue;
    const ok = await enqueueCampaignEmail({
      campaignId,
      clientId,
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email,
      location: lead.location,
      businessName,
      subject,
      body,
    }, delayMs > 0 ? delayMs : undefined);
    if (ok) queued++;
  }
  return queued;
}

/**
 * Create a campaign and enqueue all emails for async processing.
 * Returns immediately — the campaign worker processes them in the background.
 * Supports:
 * - Scheduling: enqueues with BullMQ delay if scheduledAt is set
 * - A/B testing: splits leads into A/B samples + holdout, auto-checks winner after 24h
 */
export async function sendCampaign(
  clientId: string,
  campaign: {
    name: string;
    subject: string;
    body: string;
    targetLeadIds: string[];
    scheduledAt?: string;
    abTest?: {
      enabled: boolean;
      variantSubject: string;
      variantBody: string;
      samplePercent?: number;
    };
  }
): Promise<{ queued: number; skipped: number; campaignId: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { businessName: true },
  });

  if (!client) throw new Error("Client not found");

  const isScheduled = !!campaign.scheduledAt;
  const isAbTest = campaign.abTest?.enabled;

  // Calculate delay for scheduling
  let delayMs = 0;
  if (isScheduled && campaign.scheduledAt) {
    const scheduledTime = new Date(campaign.scheduledAt).getTime();
    if (!isNaN(scheduledTime)) {
      delayMs = Math.max(0, scheduledTime - Date.now());
    }
  }

  // Create campaign record
  const emailCampaign = await prisma.emailCampaign.create({
    data: {
      clientId,
      name: campaign.name,
      subject: campaign.subject,
      body: campaign.body,
      totalRecipients: campaign.targetLeadIds.length,
      status: isScheduled ? "SCHEDULED" : "SENDING",
      scheduledAt: isScheduled && campaign.scheduledAt ? new Date(campaign.scheduledAt) : null,
      abTestEnabled: isAbTest || false,
      abTestData: isAbTest ? ({
        variantSubject: campaign.abTest!.variantSubject,
        variantBody: campaign.abTest!.variantBody,
        sampleSize: campaign.abTest!.samplePercent || 20,
        status: "PENDING",
        winner: null,
        aSampleLeadIds: [],
        bSampleLeadIds: [],
        holdoutLeadIds: [],
        aOpens: 0,
        bOpens: 0,
        aSent: 0,
        bSent: 0,
        winnerCheckAt: null,
      }) as any : {},
    },
  });

  // Get leads with emails (filtered with email not null in query)
  const leadsRaw = await prisma.lead.findMany({
    where: { id: { in: campaign.targetLeadIds }, clientId, email: { not: null } },
    select: { id: true, name: true, email: true, location: true },
  });

  // Filter to only leads with non-null emails and cast type
  const leads: LeadWithEmail[] = leadsRaw.filter((l): l is LeadWithEmail => l.email !== null);

  if (leads.length === 0) {
    await prisma.emailCampaign.update({
      where: { id: emailCampaign.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { queued: 0, skipped: campaign.targetLeadIds.length, campaignId: emailCampaign.id };
  }

  let totalQueued = 0;
  const totalSkipped = campaign.targetLeadIds.length - leads.length;

  if (isAbTest && leads.length >= 10) {
    // ─── A/B Testing Mode ───────────────────────────────────
    const samplePercent = campaign.abTest!.samplePercent || 20;
    const sampleCount = Math.max(5, Math.ceil(leads.length * samplePercent / 100));
    const shuffled = shuffle(leads);
    const aSample = shuffled.slice(0, sampleCount);
    const bSample = shuffled.slice(sampleCount, sampleCount * 2);
    const holdout = shuffled.slice(sampleCount * 2);

    // Winner check: 24h after the samples are actually sent (or after the scheduled time)
    const winnerCheckDelay = delayMs + 24 * 60 * 60 * 1000;
    const winnerCheckAt = new Date(Date.now() + winnerCheckDelay);

    // Store the split in abTestData
    await prisma.emailCampaign.update({
      where: { id: emailCampaign.id },
      data: {
        abTestData: ({
          variantSubject: campaign.abTest!.variantSubject,
          variantBody: campaign.abTest!.variantBody,
          sampleSize: sampleCount,
          status: "TESTING",
          winner: null,
          aSampleLeadIds: aSample.map(l => l.id),
          bSampleLeadIds: bSample.map(l => l.id),
          holdoutLeadIds: holdout.map(l => l.id),
          aOpens: 0,
          bOpens: 0,
          aSent: sampleCount,
          bSent: sampleCount,
          winnerCheckAt: winnerCheckAt.toISOString(),
        }) as any,
        totalRecipients: leads.length,
      },
    });

    // Enqueue sample A (variant A uses the main subject/body)
    const aQueued = await enqueueBatch(aSample, emailCampaign.id, clientId, client.businessName, campaign.subject, campaign.body, delayMs);
    // Enqueue sample B (variant B uses the alternate subject/body)
    const bQueued = await enqueueBatch(bSample, emailCampaign.id, clientId, client.businessName, campaign.abTest!.variantSubject, campaign.abTest!.variantBody, delayMs);

    totalQueued = aQueued + bQueued;

    // Schedule the winner check job to run after the test period
    await enqueueCampaignWinnerCheck({
      campaignId: emailCampaign.id,
      clientId,
    }, winnerCheckDelay);

    logger.info({
      campaignId: emailCampaign.id,
      aSample: aQueued,
      bSample: bQueued,
      holdout: holdout.length,
      winnerCheckAt: winnerCheckAt.toISOString(),
    }, "A/B test campaign samples queued");

  } else {
    // ─── Normal / Scheduled Mode ────────────────────────────
    totalQueued = await enqueueBatch(leads, emailCampaign.id, clientId, client.businessName, campaign.subject, campaign.body, delayMs);

    await prisma.emailCampaign.update({
      where: { id: emailCampaign.id },
      data: { totalRecipients: totalQueued },
    });

    if (totalQueued === 0) {
      await prisma.emailCampaign.update({
        where: { id: emailCampaign.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    logger.info({ campaignId: emailCampaign.id, queued: totalQueued, delayMs }, "Campaign emails queued");
  }

  return { queued: totalQueued, skipped: totalSkipped, campaignId: emailCampaign.id };
}

/**
 * Check if an A/B test campaign's winner can be determined and send the winner to holdout.
 * Called automatically by the scheduled BullMQ job or manually via the API.
 */
export async function checkABTestWinner(campaignId: string): Promise<{ winner: string | null; sentToHoldout: number } | null> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign || !campaign.abTestEnabled) return null;

  const abData = campaign.abTestData as unknown as ABTestData;
  if (abData.status !== "TESTING" && abData.status !== "SENDING_WINNER") return null;

  // Count opens per variant (filtering by sample lead IDs)
  const aOpens = await prisma.emailTrackingEvent.count({
    where: { campaignId, event: "open", leadId: { in: abData.aSampleLeadIds } },
  });
  const bOpens = await prisma.emailTrackingEvent.count({
    where: { campaignId, event: "open", leadId: { in: abData.bSampleLeadIds } },
  });

  const aOpenRate = abData.aSent > 0 ? (aOpens / abData.aSent) * 100 : 0;
  const bOpenRate = abData.bSent > 0 ? (bOpens / abData.bSent) * 100 : 0;

  // Pick winner: if both 0 opens default to A, otherwise higher open rate wins
  const winner: "A" | "B" = (aOpenRate === 0 && bOpenRate === 0) ? "A" : (aOpenRate >= bOpenRate ? "A" : "B");
  const winSubject = winner === "A" ? campaign.subject : abData.variantSubject;
  const winBody = winner === "A" ? campaign.body : abData.variantBody;

  const client = await prisma.client.findUnique({
    where: { id: campaign.clientId },
    select: { businessName: true },
  });
  if (!client) return null;

  // Get holdout leads (with email)
  const holdoutRaw = await prisma.lead.findMany({
    where: { id: { in: abData.holdoutLeadIds }, email: { not: null } },
    select: { id: true, name: true, email: true, location: true },
  });
  const holdoutLeads: LeadWithEmail[] = holdoutRaw.filter((l): l is LeadWithEmail => l.email !== null);

  // Send winner to holdout
  const sentToHoldout = await enqueueBatch(holdoutLeads, campaign.id, campaign.clientId, client.businessName, winSubject, winBody);

  // Update campaign with results
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      abTestData: ({
        ...abData,
        status: sentToHoldout > 0 ? "SENDING_WINNER" : "COMPLETED",
        winner,
        aOpens,
        bOpens,
        winnerCheckAt: null,
      }) as any,
    },
  });

  logger.info({ campaignId, winner, aOpenRate, bOpenRate, sentToHoldout }, "A/B test winner selected and sent to holdout");
  return { winner, sentToHoldout };
}

/**
 * Get campaign analytics including open/click rates and A/B test data.
 */
export async function getCampaignAnalytics(clientId: string) {
  const campaigns = await prisma.emailCampaign.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Get open/click counts per campaign
  const campaignIds = campaigns.map((c) => c.id);
  const eventCounts = await prisma.emailTrackingEvent.groupBy({
    by: ["campaignId", "event"],
    where: { campaignId: { in: campaignIds } },
    _count: true,
  });

  const eventMap: Record<string, { opens: number; clicks: number }> = {};
  for (const ec of eventCounts) {
    if (!eventMap[ec.campaignId]) eventMap[ec.campaignId] = { opens: 0, clicks: 0 };
    if (ec.event === "open") eventMap[ec.campaignId].opens = ec._count;
    if (ec.event === "click") eventMap[ec.campaignId].clicks = ec._count;
  }

  const campaignsWithTracking = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: c.status,
    totalRecipients: c.totalRecipients,
    deliveredCount: c.deliveredCount,
    failedCount: c.failedCount,
    openedCount: eventMap[c.id]?.opens || 0,
    clickedCount: eventMap[c.id]?.clicks || 0,
    sentAt: c.sentAt,
    createdAt: c.createdAt,
    abTestEnabled: c.abTestEnabled,
    abTestData: c.abTestData,
  }));

  const totalDelivered = campaignsWithTracking.reduce((s, c) => s + c.deliveredCount, 0);
  const totalOpened = campaignsWithTracking.reduce((s, c) => s + c.openedCount, 0);

  return {
    total: campaignsWithTracking.length,
    campaigns: campaignsWithTracking,
    summary: {
      totalSent: totalDelivered,
      totalFailed: campaignsWithTracking.reduce((s, c) => s + c.failedCount, 0),
      totalOpened,
      totalClicked: campaignsWithTracking.reduce((s, c) => s + c.clickedCount, 0),
      avgDeliveryRate: campaignsWithTracking.reduce((s, c) => s + c.totalRecipients, 0) > 0
        ? Math.round((totalDelivered / campaignsWithTracking.reduce((s, c) => s + c.totalRecipients, 0)) * 100)
        : 0,
      avgOpenRate: totalDelivered > 0
        ? Math.round((totalOpened / totalDelivered) * 100)
        : 0,
      avgClickRate: totalDelivered > 0
        ? Math.round((campaignsWithTracking.reduce((s, c) => s + c.clickedCount, 0) / totalDelivered) * 100)
        : 0,
    },
  };
}

/**
 * Email Marketing Campaign Routes.
 * POST   /campaigns/email/send        — Create campaign and queue emails
 * GET    /campaigns/email/templates   — Get available templates
 * GET    /campaigns/email/analytics   — Get campaign analytics (incl. open/click rates)
 * GET    /campaigns/email/:id         — Get single campaign details with tracking events
 * POST   /campaigns/email/:id/ab-check — Trigger A/B test winner check
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import { sendCampaign, getTemplates, getCampaignAnalytics, checkABTestWinner } from "../../services/email-campaign.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function emailCampaignRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * Get available email templates.
   */
  fastify.get("/campaigns/email/templates", async (request: FastifyRequest) => {
    return { success: true, templates: getTemplates() };
  });

  /**
   * Create and queue an email campaign (non-blocking).
   * Supports scheduling (scheduledAt) and A/B testing (abTest).
   */
  fastify.post<{
    Body: {
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
    };
  }>("/campaigns/email/send", async (request: FastifyRequest<{
    Body: { name: string; subject: string; body: string; targetLeadIds: string[]; scheduledAt?: string; abTest?: { enabled: boolean; variantSubject: string; variantBody: string; samplePercent?: number } };
  }>) => {
    const clientId = request.clientId!;
    const { name, subject, body, targetLeadIds, scheduledAt, abTest } = request.body;

    const result = await sendCampaign(clientId, { name, subject, body, targetLeadIds, scheduledAt, abTest });
    return { success: true, ...result };
  });

  /**
   * Get campaign analytics with open/click rates.
   */
  fastify.get("/campaigns/email/analytics", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const analytics = await getCampaignAnalytics(clientId);
    return { success: true, ...analytics };
  });

  /**
   * Get single campaign details with tracking events.
   */
  fastify.get<{ Params: { id: string } }>("/campaigns/email/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const clientId = request.clientId!;
    const { id } = request.params;

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, clientId },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    const recentEvents = await prisma.emailTrackingEvent.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { success: true, campaign, recentEvents };
  });

  /**
   * Trigger A/B test winner check for a campaign.
   */
  fastify.post<{ Params: { id: string } }>("/campaigns/email/:id/ab-check", async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const clientId = request.clientId!;
    const { id } = request.params;

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, clientId, abTestEnabled: true },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found or not an A/B test" });
    }

    const result = await checkABTestWinner(id);
    return { success: true, ...result };
  });
}


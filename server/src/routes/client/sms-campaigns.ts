/**
 * SMS Campaign Routes.
 * POST /campaigns/sms/send — Send SMS campaign
 * GET  /campaigns/sms/analytics — Get SMS campaign history
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendSmsCampaign } from "../../services/sms-campaign.service";
import { prisma } from "../../utils/prisma-shared";

export default async function smsCampaignRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // Feature gate — SMS campaigns are PRO only
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method === "POST") {
      const { canAccessFeature, featureGateError } = await import("../../utils/plan-gates");
      const { allowed, plan, requiredPlan } = await canAccessFeature(fastify.prisma, request.clientId!, "sms_campaigns");
      if (!allowed) {
        return reply.status(403).send(featureGateError("SMS campaigns", plan, requiredPlan));
      }
    }
  });

  fastify.post<{ Body: { name: string; message: string; targetLeadIds: string[] } }>(
    "/campaigns/sms/send", async (request: FastifyRequest<{ Body: { name: string; message: string; targetLeadIds: string[] } }>) => {
      const clientId = request.clientId!;
      const { name, message, targetLeadIds } = request.body;
      const result = await sendSmsCampaign(clientId, { name, message, targetLeadIds });
      return { success: true, ...result };
    }
  );

  fastify.get("/campaigns/sms/analytics", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const campaigns = await prisma.emailCampaign.findMany({
      where: { clientId, type: "SMS" },
      orderBy: { createdAt: "desc" }, take: 20,
    });
    return { success: true, campaigns, total: campaigns.length };
  });
}

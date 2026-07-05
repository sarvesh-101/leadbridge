/**
 * SMS Campaign Routes.
 * POST /campaigns/sms/send — Send SMS campaign
 * GET  /campaigns/sms/analytics — Get SMS campaign history
 */
import { FastifyInstance, FastifyRequest } from "fastify";
import { sendSmsCampaign } from "../../services/sms-campaign.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function smsCampaignRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

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

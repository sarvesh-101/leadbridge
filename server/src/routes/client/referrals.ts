/**
 * Referral Tracking Routes.
 * GET    /referrals/stats      — Get referral analytics
 * POST   /referrals/record     — Record a referral for a lead
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import { getReferralStats, recordReferral } from "../../services/referral.service";

export default async function referralRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // Get referral analytics
  fastify.get("/referrals/stats", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const stats = await getReferralStats(clientId);
    return { success: true, stats };
  });

  // Record a referral
  fastify.post<{ Body: { leadId: string; referredBy: string } }>(
    "/referrals/record",
    async (request: FastifyRequest<{ Body: { leadId: string; referredBy: string } }>) => {
      const clientId = request.clientId!;
      const { leadId, referredBy } = request.body;
      await recordReferral(clientId, leadId, referredBy);
      return { success: true, message: "Referral recorded" };
    }
  );
}

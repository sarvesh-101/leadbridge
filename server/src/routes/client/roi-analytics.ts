/**
 * Lead Source ROI Analytics Routes.
 * GET  /analytics/roi     — Get ROI breakdown by source
 * POST /analytics/roi/cost — Update cost-per-lead for a source
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import { getSourceROI, updateSourceCost } from "../../services/roi-analytics.service";

export default async function roiAnalyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * Get ROI analytics by lead source.
   */
  fastify.get("/analytics/roi", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const roi = await getSourceROI(clientId);
    return { success: true, ...roi };
  });

  /**
   * Update cost-per-lead for a specific source.
   */
  fastify.post<{
    Body: { source: string; costPerLead: number };
  }>("/analytics/roi/cost", async (request: FastifyRequest<{ Body: { source: string; costPerLead: number } }>) => {
    const clientId = request.clientId!;
    const { source, costPerLead } = request.body;

    await updateSourceCost(clientId, source, costPerLead);
    return { success: true, message: `Cost updated for ${source}` };
  });
}

/**
 * Google Sheets Sync Routes.
 * POST /integrations/sheets/sync — Trigger a bidirectional sync
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import { executeSync } from "../../services/sheets-sync-v2.service";

export default async function sheetsSyncRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /**
   * Trigger a bidirectional Google Sheets sync.
   */
  fastify.post<{
    Body: {
      integrationId: string;
      sheetUrl: string;
    };
  }>("/integrations/sheets/sync", async (request: FastifyRequest<{ Body: { integrationId: string; sheetUrl: string } }>) => {
    const clientId = request.clientId!;
    const { integrationId, sheetUrl } = request.body;

    const result = await executeSync(clientId, integrationId, sheetUrl);
    return { success: true, ...result };
  });
}

/**
 * Property Suggestion Routes.
 * GET  /properties/suggestions/:leadId  — Get property matches for a lead
 * GET  /properties/suggestions          — Get all leads matched to properties
 */

import { FastifyInstance, FastifyRequest } from "fastify";
import { suggestPropertiesForLead, matchAllLeadsToProperties } from "../../services/property-suggestion.service";

export default async function propertySuggestionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // Get property suggestions for a specific lead
  fastify.get<{ Params: { leadId: string } }>(
    "/properties/suggestions/:leadId",
    async (request: FastifyRequest<{ Params: { leadId: string } }>) => {
      const clientId = request.clientId!;
      const suggestions = await suggestPropertiesForLead(clientId, request.params.leadId);
      return { suggestions };
    }
  );

  // Get all leads matched to properties
  fastify.get("/properties/suggestions", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const matches = await matchAllLeadsToProperties(clientId);
    return { matches };
  });
}

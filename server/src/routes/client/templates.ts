/**
 * Template Routes — CRUD for reusable campaign templates.
 * GET    /templates        — List templates
 * POST   /templates        — Save template
 * GET    /templates/:id    — Get template
 * PATCH  /templates/:id    — Update template
 * DELETE /templates/:id    — Delete template
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { listTemplates, saveTemplate, getTemplate, updateTemplate, deleteTemplate } from "../../services/template.service";

export default async function templateRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/templates", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const templates = await listTemplates(clientId);
    return { success: true, templates };
  });

  fastify.post<{ Body: { name: string; subject: string; body: string; type?: "email" | "sms" } }>(
    "/templates", async (request: FastifyRequest<{ Body: { name: string; subject: string; body: string; type?: "email" | "sms" } }>) => {
      const clientId = request.clientId!;
      const template = await saveTemplate(clientId, request.body);
      return { success: true, template };
    }
  );

  fastify.get<{ Params: { id: string } }>("/templates/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const template = await getTemplate(request.params.id, clientId);
    if (!template) return reply.status(404).send({ error: "Template not found" });
    return { success: true, template };
  });

  fastify.patch<{ Params: { id: string }; Body: { name?: string; subject?: string; body?: string } }>(
    "/templates/:id", async (request: FastifyRequest<{ Params: { id: string }; Body: { name?: string; subject?: string; body?: string } }>) => {
      const clientId = request.clientId!;
      const template = await updateTemplate(request.params.id, clientId, request.body);
      return { success: true, template };
    }
  );

  fastify.delete<{ Params: { id: string } }>("/templates/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    await deleteTemplate(request.params.id, clientId);
    return { success: true };
  });
}

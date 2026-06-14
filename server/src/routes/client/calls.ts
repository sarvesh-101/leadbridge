import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getSignedUrl } from "../../services/storage.service";

export default async function clientCallRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List Calls ───────────────────────────────────────────────
  fastify.get("/calls", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { page = "1", limit = "20", leadId } = request.query as Record<string, string>;

    const where: Record<string, unknown> = { clientId };
    if (leadId) where.leadId = leadId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [calls, total] = await Promise.all([
      fastify.prisma.call.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          lead: { select: { name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.call.count({ where }),
    ]);

    return { calls, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ─── Get Call Detail ──────────────────────────────────────────
  fastify.get("/calls/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const call = await fastify.prisma.call.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      include: {
        lead: { select: { name: true, phone: true } },
      },
    });

    if (!call) {
      return reply.status(404).send({ error: "Call not found" });
    }

    return { call };
  });

  // ─── Get Recording URL (signed, 1-hour expiry) ───────────────
  fastify.get("/calls/:id/recording", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const call = await fastify.prisma.call.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      select: { recordingUrl: true, id: true },
    });

    if (!call?.recordingUrl) {
      return reply.status(404).send({ error: "No recording available" });
    }

    // Extract bucket path from recording URL
    const urlParts = call.recordingUrl.split("/");
    const bucketPath = urlParts.slice(urlParts.indexOf("call-recordings")).join("/");

    const signedUrl = await getSignedUrl("call-recordings", bucketPath);
    if (!signedUrl) {
      return reply.status(500).send({ error: "Failed to generate recording URL" });
    }

    return { recordingUrl: signedUrl, expiresIn: "3600s" };
  });
}

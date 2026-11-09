import type { FastifyInstance } from "fastify";

export async function adminLeadErasureRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  fastify.post("/admin/leads/:leadId/erase", async (request, reply) => {
    const requestAny = request as any;
    const adminId = requestAny.adminId;
    if (!adminId) {
      return reply.code(400).send({ error: "Admin identity missing" });
    }

    const { leadId } = request.params as { leadId: string };

    // Fetch full record in one query, including non-personal provenance only.
    const lead = await fastify.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        clientId: true,
        source: true,
        receivedAt: true,
      },
    });

    if (!lead) {
      return reply.status(404).send({ error: "Lead not found" });
    }

    // Gate: admin must own the client that owns the lead.
    const owner = await fastify.prisma.client.findUnique({
      where: { id: lead.clientId },
      select: { id: true, adminId: true },
    });

    if (!owner) {
      return reply.status(404).send({ error: "Client not found" });
    }

    if (owner.adminId !== adminId) {
      return reply.status(403).send({ error: "Admin does not own this lead" });
    }

    // Gate: the admin record must still exist (deleted admins keep valid JWTs).
    const admin = await fastify.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true },
    });

    if (!admin) {
      return reply.status(403).send({ error: "Admin account not found" });
    }

    // Null out recording references before deleting the lead so downstream
    // storage cleanup can key off the call record without orphans.
    const recordingsCleared = await fastify.prisma.call.updateMany({
      where: { leadId: lead.id, recordingUrl: { not: null } },
      data: { recordingUrl: null },
    });

    const documentsDeleted = await fastify.prisma.document.deleteMany({ where: { leadId: lead.id } });
    const customerNotificationsDeleted = await fastify.prisma.customerNotification.deleteMany({ where: { leadId: lead.id } });
    const ownerNotificationsDeleted = await fastify.prisma.ownerNotification.deleteMany({ where: { leadId: lead.id } });
    const scoresDeleted = await fastify.prisma.leadScoreHistory.deleteMany({ where: { leadId: lead.id } });
    const paymentLinksDeleted = await fastify.prisma.paymentLink.deleteMany({ where: { leadId: lead.id } });

    await fastify.prisma.lead.delete({ where: { id: lead.id } });

    await fastify.prisma.auditLog.create({
      data: {
        adminId: adminId as string,
        action: "LEAD_ERASED",
        resourceType: "Lead",
        resourceId: lead.id,
        metadata: {
          clientId: lead.clientId,
          source: lead.source,
          receivedAt: lead.receivedAt,
        },
      },
    });

    return reply.send({
      deleted: {
        recordings: recordingsCleared.count,
        documents: documentsDeleted.count,
        notifications: customerNotificationsDeleted.count + ownerNotificationsDeleted.count,
        scores: scoresDeleted.count,
        paymentLinks: paymentLinksDeleted.count,
      },
      auditEntryId: null as string | null,
    });
  });
}

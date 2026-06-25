/**
 * Admin Audit Log Routes — ported from FastAPI Python backend.
 *
 * Browse and summarize platform-wide audit activity.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export default async function adminAuditLogRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── List Audit Logs ──────────────────────────────────────────
  // Ported from FastAPI: GET /admin/audit-logs
  fastify.get("/admin/audit-logs", async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      page = "1",
      pageSize = "50",
      action,
      resourceType,
      clientId,
      days = "7",
    } = request.query as Record<string, string>;

    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      createdAt: { gte: since },
    };

    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (clientId) where.clientId = clientId;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);

    const [items, total] = await Promise.all([
      fastify.prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { businessName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        clientId: log.clientId,
        clientName: log.client?.businessName || null,
        userId: log.userId,
        adminId: log.adminId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        changes: log.changes,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        status: log.status,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
      })),
      total,
      page: parseInt(page),
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  });

  // ─── Audit Log Summary ────────────────────────────────────────
  // Ported from FastAPI: GET /admin/audit-logs/summary
  fastify.get("/admin/audit-logs/summary", async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const logs = await fastify.prisma.auditLog.findMany({
      where: { createdAt: { gte: todayStart } },
      select: { action: true },
    });

    // Group by action type
    const actionsByType: Record<string, number> = {};
    for (const log of logs) {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
    }

    return {
      todayTotal: logs.length,
      actionsByType,
    };
  });
}

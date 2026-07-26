/**
 * Admin Revenue Recognition Routes
 *
 * GET  /admin/revenue/overview    — Summary of deferred vs recognized revenue
 * GET  /admin/revenue/entries     — All accounting entries with pagination
 * POST /admin/revenue/trigger     — Manually trigger revenue recognition
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { runRevenueRecognition } from "../../cron/revenue-recognition";

export default async function adminRevenueRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── Revenue Overview ──────────────────────────────────────────
  fastify.get("/admin/revenue/overview", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [deferred, recognized, reversed, byType] = await Promise.all([
        fastify.prisma.accountingEntry.aggregate({
          _sum: { amount: true, deferredAmount: true, recognizedAmount: true },
          _count: { id: true },
          where: { status: "DEFERRED" },
        }),
        fastify.prisma.accountingEntry.aggregate({
          _sum: { amount: true, recognizedAmount: true },
          _count: { id: true },
          where: { status: "RECOGNIZED" },
        }),
        fastify.prisma.accountingEntry.aggregate({
          _sum: { amount: true },
          _count: { id: true },
          where: { status: "REVERSED" },
        }),
        fastify.prisma.accountingEntry.groupBy({
          by: ["type"],
          _sum: { amount: true, recognizedAmount: true, deferredAmount: true },
          _count: { id: true },
        }),
      ]);

      return {
        deferred: {
          count: deferred._count.id,
          totalAmount: deferred._sum.amount || 0,
          deferredAmount: deferred._sum.deferredAmount || 0,
          recognizedAmount: deferred._sum.recognizedAmount || 0,
        },
        recognized: {
          count: recognized._count.id,
          totalAmount: recognized._sum.amount || 0,
          recognizedAmount: recognized._sum.recognizedAmount || 0,
        },
        reversed: {
          count: reversed._count.id,
          totalAmount: reversed._sum.amount || 0,
        },
        byType: byType.map((e) => ({
          type: e.type,
          count: e._count.id,
          totalAmount: e._sum.amount || 0,
          recognizedAmount: e._sum.recognizedAmount || 0,
          deferredAmount: e._sum.deferredAmount || 0,
        })),
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch revenue overview" });
    }
  });

  // ─── Revenue Entries (paginated) ──────────────────────────────
  fastify.get("/admin/revenue/entries", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = "1", limit = "20", status, clientId } = request.query as Record<string, string>;
      const where: Record<string, unknown> = {};
      if (status && ["DEFERRED", "RECOGNIZED", "REVERSED"].includes(status)) where.status = status;
      if (clientId) where.clientId = clientId;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [entries, total] = await Promise.all([
        fastify.prisma.accountingEntry.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: {
            client: { select: { businessName: true, ownerName: true } },
            invoice: { select: { invoiceNumber: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        fastify.prisma.accountingEntry.count({ where }),
      ]);

      return {
        entries,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch entries" });
    }
  });

  // ─── Trigger Revenue Recognition Manually ─────────────────────
  fastify.post("/admin/revenue/trigger", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await runRevenueRecognition(fastify.prisma);
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Revenue recognition failed" });
    }
  });
}

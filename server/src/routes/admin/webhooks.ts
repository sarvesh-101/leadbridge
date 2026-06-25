/**
 * Admin Webhook Monitoring Routes
 *
 * Provides visibility into all webhook endpoints across the platform:
 * - Webhook sources (ingest tokens) per client
 * - Recent webhook events from audit logs
 * - Success/failure rates
 * - Call event webhook health (Omnidimension, Exotel)
 */
import { FastifyInstance, FastifyRequest } from "fastify";

export default async function adminWebhookRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── Webhook Sources Overview ────────────────────────────
  fastify.get("/admin/webhooks/sources", async (_request: FastifyRequest) => {
    const sources = await fastify.prisma.webhookSource.findMany({
      include: {
        client: {
          select: {
            id: true,
            businessName: true,
            ownerName: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalSources = sources.length;
    const activeSources = sources.filter((s) => s.active).length;
    const inactiveSources = totalSources - activeSources;

    // Group by source type
    const byType: Record<string, number> = {};
    for (const s of sources) {
      byType[s.type] = (byType[s.type] || 0) + 1;
    }

    return {
      totalSources,
      activeSources,
      inactiveSources,
      byType,
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        token: s.token,
        active: s.active,
        hasParserConfig: Object.keys((s.parserConfig as Record<string, unknown>) || {}).length > 0,
        clientId: s.clientId,
        clientName: s.client?.businessName || null,
        clientOwner: s.client?.ownerName || null,
        clientCity: s.client?.city || null,
        createdAt: s.createdAt,
      })),
    };
  });

  // ─── Webhook Event Feed ──────────────────────────────────
  fastify.get("/admin/webhooks/events", async (request: FastifyRequest) => {
    const {
      page = "1",
      pageSize = "30",
      status,
      source,
    } = request.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const take = parseInt(pageSize);

    // Query audit logs with webhook-related actions
    const webhookActions = [
      "ingest.received",
      "ingest.parsed",
      "ingest.duplicate",
      "webhook.received",
      "webhook.failed",
      "webhook.retried",
      "call.event.received",
      "call.event.processed",
      "payment.webhook.received",
      "whatsapp.webhook.received",
    ];

    const where: Record<string, unknown> = {
      action: { in: webhookActions },
    };

    if (status) where.status = status;
    if (source) where.resourceType = source;

    const [items, total] = await Promise.all([
      fastify.prisma.auditLog.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { businessName: true, id: true } },
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
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        changes: log.changes,
        ipAddress: log.ipAddress,
        status: log.status,
        errorMessage: log.errorMessage,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
      total,
      page: parseInt(page),
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  });

  // ─── Webhook Health Summary ──────────────────────────────
  fastify.get("/admin/webhooks/health", async (_request: FastifyRequest) => {
    // Get last 24 hours of webhook audit activity
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentEvents = await fastify.prisma.auditLog.findMany({
      where: {
        action: { in: ["ingest.received", "call.event.received", "payment.webhook.received", "whatsapp.webhook.received"] },
        createdAt: { gte: since },
      },
      select: {
        action: true,
        status: true,
        createdAt: true,
      },
    });

    const total24h = recentEvents.length;
    const failed24h = recentEvents.filter((e) => e.status === "failure").length;
    const success24h = total24h - failed24h;

    // Per-endpoint breakdown
    const byEndpoint: Record<string, { total: number; failed: number }> = {};
    for (const event of recentEvents) {
      if (!byEndpoint[event.action]) byEndpoint[event.action] = { total: 0, failed: 0 };
      byEndpoint[event.action].total++;
      if (event.status === "failure") byEndpoint[event.action].failed++;
    }

    return {
      period: "24h",
      since: since.toISOString(),
      total: total24h,
      success: success24h,
      failed: failed24h,
      successRate: total24h > 0 ? Math.round((success24h / total24h) * 100) : 100,
      byEndpoint,
    };
  });

  // ─── Ingest Sources Stats ────────────────────────────────
  fastify.get("/admin/webhooks/ingest-stats", async (_request: FastifyRequest) => {
    // Get lead counts grouped by source for the last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const leads = await fastify.prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: {
        source: true,
        status: true,
        createdAt: true,
      },
    });

    const bySource: Record<string, { total: number; booked: number; cold: number; failed: number }> = {};
    for (const lead of leads) {
      if (!bySource[lead.source]) bySource[lead.source] = { total: 0, booked: 0, cold: 0, failed: 0 };
      bySource[lead.source].total++;
      if (lead.status === "BOOKED" || lead.status === "CONVERTED") bySource[lead.source].booked++;
      if (lead.status === "COLD" || lead.status === "NO_ANSWER") bySource[lead.source].cold++;
      if (lead.status === "CALL_FAILED") bySource[lead.source].failed++;
    }

    return {
      period: "30d",
      since: since.toISOString(),
      bySource,
    };
  });
}

/**
 * Prometheus Metrics Endpoint
 * GET /api/v1/metrics
 *
 * Exposes key business & system metrics for Prometheus scraping.
 * Also exposes a simple GET /metrics for direct health monitoring.
 *
 * Metrics exposed:
 * - leadbridge_leads_total{status} — leads by current status
 * - leadbridge_calls_total — total calls placed
 * - leadbridge_bookings_total — total bookings created
 * - leadbridge_clients_active — clients with ACTIVE or TRIAL plan
 * - leadbridge_usage_calls{client_id} — calls used this month per client
 * - leadbridge_queue_depth{queue} — pending jobs per BullMQ queue
 * - process_uptime_seconds — how long the server has been running
 */
import { FastifyInstance } from "fastify";

export default async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get("/metrics", async (_request, reply) => {
    const start = Date.now();

    try {
      // ─── Aggregate metrics in parallel ─────────────────────────
      const [
        leadCounts,
        totalCalls,
        totalBookings,
        activeClients,
        clientUsage,
        queueDepths,
      ] = await Promise.all([
        // Leads by status
        fastify.prisma.lead.groupBy({
          by: ["status"],
          _count: true,
        }),

        // Total calls
        fastify.prisma.call.count(),

        // Total bookings
        fastify.prisma.booking.count(),

        // Active clients
        fastify.prisma.client.count({
          where: { planStatus: { in: ["ACTIVE", "TRIAL"] } },
        }),

        // Per-client usage
        fastify.prisma.client.findMany({
          where: { planStatus: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true, callsThisMonth: true, callsLimit: true, plan: true },
          take: 100,
        }),

        // BullMQ queue depths (via Redis)
        getQueueDepths(fastify),
      ]);

      // ─── Build Prometheus format ──────────────────────────────
      const lines: string[] = [];

      // Header
      lines.push("# HELP leadbridge_leads_total Total leads by status");
      lines.push("# TYPE leadbridge_leads_total gauge");
      for (const row of leadCounts) {
        lines.push(`leadbridge_leads_total{status="${row.status}"} ${row._count}`);
      }

      lines.push("# HELP leadbridge_calls_total Total calls placed");
      lines.push("# TYPE leadbridge_calls_total counter");
      lines.push(`leadbridge_calls_total ${totalCalls}`);

      lines.push("# HELP leadbridge_bookings_total Total bookings created");
      lines.push("# TYPE leadbridge_bookings_total counter");
      lines.push(`leadbridge_bookings_total ${totalBookings}`);

      lines.push("# HELP leadbridge_clients_active Active clients (ACTIVE + TRIAL)");
      lines.push("# TYPE leadbridge_clients_active gauge");
      lines.push(`leadbridge_clients_active ${activeClients}`);

      lines.push("# HELP leadbridge_usage_calls Calls used this month per client");
      lines.push("# TYPE leadbridge_usage_calls gauge");
      for (const c of clientUsage) {
        lines.push(`leadbridge_usage_calls{client_id="${c.id}",plan="${c.plan}",limit="${c.callsLimit}"} ${c.callsThisMonth}`);
      }

      lines.push("# HELP leadbridge_queue_depth Pending jobs per BullMQ queue");
      lines.push("# TYPE leadbridge_queue_depth gauge");
      for (const [queue, depth] of Object.entries(queueDepths)) {
        lines.push(`leadbridge_queue_depth{queue="${queue}"} ${depth}`);
      }

      // Process info
      lines.push("# HELP process_uptime_seconds Server uptime");
      lines.push("# TYPE process_uptime_seconds counter");
      lines.push(`process_uptime_seconds ${Math.floor(process.uptime())}`);

      lines.push("# HELP leadbridge_scrape_duration_seconds Metrics scrape duration");
      lines.push("# TYPE leadbridge_scrape_duration_seconds gauge");
      lines.push(`leadbridge_scrape_duration_seconds ${(Date.now() - start) / 1000}`);

      return reply
        .header("Content-Type", "text/plain; charset=utf-8")
        .send(lines.join("\n") + "\n");
    } catch (error: any) {
      fastify.log.error({ err: error.message }, "Metrics scrape failed");

      // Return partial metrics on error
      return reply
        .header("Content-Type", "text/plain; charset=utf-8")
        .status(500)
        .send([
          "# ERROR Metrics scrape failed — partial data",
          `# error ${error.message}`,
          `process_uptime_seconds ${Math.floor(process.uptime())}`,
        ].join("\n") + "\n");
    }
  });

  // ─── Also register a direct /metrics outside API prefix ──────
  // This is added separately in index.ts, but we also provide it here
  // for when the route is registered under the API prefix.
  fastify.get("/api/v1/metrics", async (_request, reply) => {
    // Redirect to the main /metrics endpoint
    return reply.redirect("/metrics");
  });
}

/**
 * Get BullMQ queue depths via Redis.
 * Queries each queue for waiting + active + delayed job counts.
 */
async function getQueueDepths(fastify: FastifyInstance): Promise<Record<string, number>> {
  const queueNames = ["call", "notification", "followup", "reminder", "extraction", "webhook-retry"];
  const depths: Record<string, number> = {};

  for (const name of queueNames) {
    try {
      const redis = fastify.redis as any;
      // Use Redis LLEN for the queue lists
      const waiting = await redis?.llen?.(`bull:${name}:wait`) ?? 0;
      const active = await redis?.llen?.(`bull:${name}:active`) ?? 0;
      const delayed = await redis?.zcard?.(`bull:${name}:delayed`) ?? 0;
      depths[name] = Number(waiting) + Number(active) + Number(delayed);
    } catch {
      depths[name] = -1; // Redis unavailable
    }
  }

  return depths;
}

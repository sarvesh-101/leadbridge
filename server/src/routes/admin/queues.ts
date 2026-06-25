/**
 * Admin Queue Monitoring Routes
 *
 * Exposes BullMQ queue depths, job counts, and worker status
 * by reading directly from Redis via the shared connection.
 */
import { FastifyInstance, FastifyRequest } from "fastify";

const QUEUE_NAMES = [
  "call",
  "notification",
  "followup",
  "reminder",
  "extraction",
  "webhook-retry",
] as const;

export default async function adminQueueRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── Queue Statistics ─────────────────────────────────────────
  fastify.get("/admin/queues/stats", async (_request: FastifyRequest) => {
    const redis = fastify.redis;

    if (!redis) {
      return {
        available: false,
        message: "Redis not connected — queue metrics unavailable",
        queues: [],
      };
    }

    const results = await Promise.allSettled(
      QUEUE_NAMES.map(async (name) => {
        const prefix = `bull:${name}`;

        // Key naming convention for BullMQ v4+:
        //   bull:<name>:waiting          — list of waiting jobs
        //   bull:<name>:active           — list of active jobs
        //   bull:<name>:delayed          — sorted set of delayed jobs
        //   bull:<name>:failed           — list of failed jobs
        //   bull:<name>:completed        — list of completed jobs
        //   bull:<name>:paused           — set (if queue is paused)
        //   bull:<name>:repeat           — sorted set of repeatable jobs
        //   bull:<name>:meta             — hash with queue metadata

        const [waiting, active, delayed, failed, completed, paused] = await Promise.all([
          redis.llen(`${prefix}:wait`),
          redis.llen(`${prefix}:active`),
          redis.zcard(`${prefix}:delayed`),
          redis.llen(`${prefix}:failed`),
          redis.llen(`${prefix}:completed`),
          redis.exists(`${prefix}:paused`),
        ]);

        // Get the most recent failed job for error insights
        let latestError: string | null = null;
        if (failed > 0) {
          try {
            const recentFailed = await redis.lrange(`${prefix}:failed`, 0, 0);
            if (recentFailed.length > 0) {
              const parsed = JSON.parse(recentFailed[0]);
              latestError = parsed.failedReason
                ? parsed.failedReason.slice(0, 200)
                : null;
            }
          } catch {
            // best-effort
          }
        }

        return {
          name,
          waiting,
          active,
          delayed,
          failed,
          completed,
          paused: paused > 0,
          total: waiting + active + delayed + failed,
          latestError,
        };
      })
    );

    const queues = results.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { name: QUEUE_NAMES[i], error: r.reason?.message || "Unknown error" }
    );

    const totals = queues.reduce(
      (acc, q) => {
        if ("waiting" in q) {
          acc.waiting += q.waiting as number;
          acc.active += q.active as number;
          acc.delayed += q.delayed as number;
          acc.failed += q.failed as number;
          acc.total += q.total as number;
        }
        return acc;
      },
      { waiting: 0, active: 0, delayed: 0, failed: 0, total: 0 }
    );

    return {
      available: true,
      totalJobs: totals.total,
      activeJobs: totals.active,
      waitingJobs: totals.waiting,
      failedJobs: totals.failed,
      delayedJobs: totals.delayed,
      queues,
    };
  });

  // ─── Queue Action: retry all failed jobs for a queue ──────────
  fastify.post("/admin/queues/:name/retry", async (
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: any
  ) => {
    const { name } = request.params;
    if (!QUEUE_NAMES.includes(name as any)) {
      return reply.status(400).send({ error: `Unknown queue '${name}'` });
    }

    const redis = fastify.redis;
    if (!redis) {
      return reply.status(503).send({ error: "Redis unavailable" });
    }

    // Move failed jobs back to waiting by renaming the list
    const prefix = `bull:${name}`;
    const failedCount = await redis.llen(`${prefix}:failed`);

    if (failedCount > 0) {
      // Read all failed jobs
      const failedJobs = await redis.lrange(`${prefix}:failed`, 0, -1);
      // Push them to the wait queue
      if (failedJobs.length > 0) {
        await redis.rpush(`${prefix}:wait`, ...failedJobs);
      }
      // Clear the failed list
      await redis.del(`${prefix}:failed`);
    }

    fastify.log.info({ queue: name, retried: failedCount }, "Retried failed queue jobs");

    return {
      message: `Retried ${failedCount} jobs in '${name}' queue`,
      retried: failedCount,
    };
  });

  // ─── Queue Action: flush completed jobs for a queue ──────────
  fastify.post("/admin/queues/:name/flush-completed", async (
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: any
  ) => {
    const { name } = request.params;
    if (!QUEUE_NAMES.includes(name as any)) {
      return reply.status(400).send({ error: `Unknown queue '${name}'` });
    }

    const redis = fastify.redis;
    if (!redis) {
      return reply.status(503).send({ error: "Redis unavailable" });
    }

    const prefix = `bull:${name}`;
    const completedCount = await redis.llen(`${prefix}:completed`);
    await redis.del(`${prefix}:completed`);

    fastify.log.info({ queue: name, flushed: completedCount }, "Flushed completed queue jobs");

    return {
      message: `Flushed ${completedCount} completed jobs from '${name}' queue`,
      flushed: completedCount,
    };
  });
}

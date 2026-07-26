/**
 * Redis Recovery Cron — replays pending jobs stored in the database.
 *
 * When Redis is unavailable, the enqueue functions in queues.ts store
 * jobs in the PendingJob table instead. This cron runs every 30 seconds
 * and replays those jobs once Redis is back.
 *
 * Process:
 *   1. Check if Redis is available (BullMQ queues are working)
 *   2. If yes, read PENDING jobs from PendingJob table (oldest first)
 *   3. Re-enqueue each job via the original queue
 *   4. Mark as COMPLETED on success, FAILED on error
 *
 * This prevents lead loss during Redis outages.
 */

import { prisma } from "../utils/prisma-shared";
import { logger } from "../utils/logger";
import {
  isRedisAvailable,
  enqueueCall,
  enqueueNotification,
  enqueueFollowup,
  enqueueReminder,
  enqueueExtraction,
} from "../workers/queues";

const BATCH_SIZE = 50;

/**
 * Recover pending jobs from the database and re-enqueue them to Redis.
 * Runs every 30 seconds when Redis is available.
 */
export async function recoverPendingJobs(): Promise<{ recovered: number; failed: number }> {
  // Only run if Redis is available
  if (!isRedisAvailable()) {
    logger.debug("Redis not available — skipping pending job recovery");
    return { recovered: 0, failed: 0 };
  }

  const pendingJobs = await prisma.pendingJob.findMany({
    where: {
      status: "PENDING",
      processAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (pendingJobs.length === 0) {
    return { recovered: 0, failed: 0 };
  }

  logger.info({ count: pendingJobs.length }, "Recovering pending jobs from DB to Redis");

  let recovered = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    try {
      const jobData = job.jobData as Record<string, unknown>;

      // Re-enqueue to the appropriate queue based on the job type
      let enqueued = false;

      switch (job.queue) {
        case "call":
          enqueued = await enqueueCall(jobData as any, job.delayMs);
          break;
        case "notification":
          enqueued = await enqueueNotification(jobData as any, job.delayMs);
          break;
        case "followup":
          enqueued = await enqueueFollowup(jobData as any, job.delayMs);
          break;
        case "reminder":
          enqueued = await enqueueReminder(jobData as any, job.delayMs);
          break;
        case "extraction":
          enqueued = await enqueueExtraction(jobData as any, job.delayMs);
          break;
        default:
          logger.warn({ queue: job.queue, jobId: job.id }, "Unknown queue type for pending job recovery");
          // Mark as failed so it doesn't get retried indefinitely
          await prisma.pendingJob.update({
            where: { id: job.id },
            data: { status: "FAILED", error: `Unknown queue: ${job.queue}`, processedAt: new Date() },
          });
          failed++;
          continue;
      }

      if (enqueued) {
        await prisma.pendingJob.update({
          where: { id: job.id },
          data: { status: "COMPLETED", processedAt: new Date() },
        });
        recovered++;
      } else {
        // Redis might have gone down again — leave as PENDING for next cycle
        await prisma.pendingJob.update({
          where: { id: job.id },
          data: { attempts: { increment: 1 } },
        });
        failed++;
      }
    } catch (error: any) {
      logger.error({ jobId: job.id, err: error.message }, "Failed to recover pending job");
      await prisma.pendingJob.update({
        where: { id: job.id },
        data: { attempts: { increment: 1 }, error: error.message },
      });
      failed++;
    }
  }

  logger.info({ recovered, failed, total: pendingJobs.length }, "Pending job recovery cycle complete");
  return { recovered, failed };
}

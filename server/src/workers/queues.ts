import { Queue, Worker, ConnectionOptions } from "bullmq";
import { config } from "../config";
import { logger } from "../utils/logger";

const connection: ConnectionOptions = {
  url: config.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const QUEUE_NAMES = {
  CALL: "call",
  NOTIFICATION: "notification",
  FOLLOWUP: "followup",
  REMINDER: "reminder",
  EXTRACTION: "extraction",
  WEBHOOK_RETRY: "webhook-retry",
  EMAIL_CAMPAIGN: "email-campaign",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─────────────────────────────────────
// Lazy Queue Factory
// Queues are created lazily so the server can start without Redis.
// In development, if Redis is unavailable, enqueue functions become no-ops.
// ─────────────────────────────────────

let redisAvailable: boolean | null = null;

function getDefaultJobOptions(attempts: number, delay: number) {
  return {
    attempts,
    backoff: { type: "fixed" as const, delay },
    removeOnComplete: 100,
    removeOnFail: 50,
  };
}

function createQueue(name: string, attempts: number, delay: number): Queue | null {
  if (redisAvailable === false) return null;
  try {
    const q = new Queue(name, {
      connection,
      defaultJobOptions: getDefaultJobOptions(attempts, delay),
    });
    q.on("error", (err: Error) => {
      logger.warn({ err: err.message, queue: name }, "Queue error — disabling Redis queues");
      redisAvailable = false;
    });
    return q;
  } catch (err: any) {
    logger.warn({ err: err.message, queue: name }, "Failed to create queue — disabling Redis");
    redisAvailable = false;
    return null;
  }
}

let _callQueue: Queue | null | undefined;
let _notificationQueue: Queue | null | undefined;
let _followupQueue: Queue | null | undefined;
let _reminderQueue: Queue | null | undefined;
let _extractionQueue: Queue | null | undefined;
let _webhookRetryQueue: Queue | null | undefined;
let _emailCampaignQueue: Queue | null | undefined;

function getCallQueue() {
  if (_callQueue === undefined) _callQueue = createQueue(QUEUE_NAMES.CALL, 3, 5000);
  return _callQueue;
}
function getNotificationQueue() {
  if (_notificationQueue === undefined) _notificationQueue = createQueue(QUEUE_NAMES.NOTIFICATION, 5, 2000);
  return _notificationQueue;
}
function getFollowupQueue() {
  if (_followupQueue === undefined) _followupQueue = createQueue(QUEUE_NAMES.FOLLOWUP, 3, 10000);
  return _followupQueue;
}
function getReminderQueue() {
  if (_reminderQueue === undefined) _reminderQueue = createQueue(QUEUE_NAMES.REMINDER, 3, 5000);
  return _reminderQueue;
}
function getExtractionQueue() {
  if (_extractionQueue === undefined) _extractionQueue = createQueue(QUEUE_NAMES.EXTRACTION, 3, 3000);
  return _extractionQueue;
}
function getWebhookRetryQueue() {
  if (_webhookRetryQueue === undefined) _webhookRetryQueue = createQueue(QUEUE_NAMES.WEBHOOK_RETRY, 5, 2000);
  return _webhookRetryQueue;
}
function getEmailCampaignQueue() {
  if (_emailCampaignQueue === undefined) _emailCampaignQueue = createQueue(QUEUE_NAMES.EMAIL_CAMPAIGN, 3, 5000);
  return _emailCampaignQueue;
}

// ─────────────────────────────────────
// Job Type Definitions
// ─────────────────────────────────────

export interface CallJob {
  leadId: string;
  clientId: string;
  callType: "QUALIFICATION" | "BOOKING_REMINDER" | "FOLLOWUP_D1" | "FOLLOWUP_D3";
  attempt: number;
}

export interface NotificationJob {
  recipient: "customer" | "owner";
  leadId: string;
  clientId: string;
  type: string;
  bookingId?: string;
  data: Record<string, string>;
}

export interface CampaignEmailJob {
  campaignId: string;
  clientId: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  location: string | null;
  businessName: string;
  subject: string;
  body: string;
}

export interface CampaignWinnerCheckJob {
  campaignId: string;
  clientId: string;
}

export interface FollowupJob {
  leadId: string;
  clientId: string;
  day: 1 | 2 | 3;
}

export interface ReminderJob {
  leadId: string;
  clientId: string;
  bookingId: string;
}

export interface ExtractionJob {
  callId: string;
  leadId: string;
  clientId: string;
  transcript: string;
}

// ─────────────────────────────────────
// Helper: Add jobs with proper typing
// ─────────────────────────────────────

/**
 * Redis health tracking — exposed via the /health endpoint.
 * Allows external monitoring to detect when queues are degraded.
 */
export function isRedisAvailable(): boolean {
  return redisAvailable !== false;
}

export function getRedisAvailable(): boolean | null {
  return redisAvailable;
}

export async function enqueueCall(job: CallJob, delayMs?: number): Promise<boolean> {
  const q = getCallQueue();
  const jobId = `call:${job.leadId}:${job.callType}:${job.attempt}`;

  if (!q) {
    logger.error({ job }, "Redis unavailable — storing call job in DB for replay when Redis recovers.");
    await storePendingJob("call", job, jobId, delayMs ?? 0);
    return false;
  }

  await q.add(jobId, job, { delay: delayMs ?? 0 });
  return true;
}

export async function enqueueNotification(job: NotificationJob, delayMs?: number): Promise<boolean> {
  const q = getNotificationQueue();
  const jobId = `notify:${job.type}:${job.leadId}`;

  if (!q) {
    logger.error({ job }, "Redis unavailable — storing notification in DB for later replay.");
    await storePendingJob("notification", job, jobId, delayMs ?? 0);
    return false;
  }

  await q.add(jobId, job, { delay: delayMs ?? 0 });
  return true;
}

export async function enqueueFollowup(job: FollowupJob, delayMs?: number): Promise<boolean> {
  const q = getFollowupQueue();
  const jobId = `followup:D${job.day}:${job.leadId}`;

  if (!q) {
    logger.error({ job }, "Redis unavailable — storing followup in DB for later replay.");
    await storePendingJob("followup", job, jobId, delayMs ?? 0);
    return false;
  }

  await q.add(jobId, job, { delay: delayMs ?? 0 });
  return true;
}

/**
 * Track reminder job IDs in the database so they can be removed on cancellation.
 */
async function storePendingJob(queue: string, jobData: unknown, jobId: string, delayMs: number) {
  try {
    const { prisma } = await import("../utils/prisma-shared");
    await prisma.pendingJob.create({
      data: {
        queue,
        jobData: jobData as any,
        jobId,
        status: "PENDING",
        delayMs,
        processAt: new Date(Date.now() + delayMs),
      },
    });
  } catch (err: any) {
    logger.warn({ err: err.message, queue, jobId }, "Failed to store pending job in DB");
  }
}

export async function enqueueReminder(job: ReminderJob, delayMs?: number): Promise<boolean> {
  const q = getReminderQueue();
  const reminderJobId = `reminder:${job.bookingId}`;

  if (!q) {
    logger.error({ job }, "Redis unavailable — reminder NOT queued! Storing in DB for later replay.");
    await storePendingJob("reminder", job, reminderJobId, delayMs ?? 0);
    return false;
  }

  await q.add(reminderJobId, job, { delay: delayMs ?? 0 });

  // Store the job ID on the booking so we can remove it on cancellation
  try {
    const { prisma } = await import("../utils/prisma-shared");
    await prisma.booking.update({
      where: { id: job.bookingId },
      data: { reminderJobId },
    });
  } catch (err: any) {
    logger.warn({ err: err.message, bookingId: job.bookingId }, "Failed to store reminder job ID on booking");
  }

  return true;
}

/**
 * Remove a scheduled reminder job from the queue when a booking is cancelled or rescheduled.
 * This prevents the worker from processing stale reminders.
 */
export async function cancelReminderJob(bookingId: string): Promise<boolean> {
  try {
    // Try to get the job ID from the booking
    const { prisma } = await import("../utils/prisma-shared");
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { reminderJobId: true },
    });

    if (!booking?.reminderJobId) {
      return false; // No scheduled reminder to cancel
    }

    // Remove from Redis queue
    const q = getReminderQueue();
    if (q) {
      const removed = await q.remove(booking.reminderJobId);
      logger.info({ bookingId, reminderJobId: booking.reminderJobId, removed }, "Reminder job removed from queue");
    }

    // Also remove from pending jobs DB table (if Redis was down when scheduled)
    await prisma.pendingJob.updateMany({
      where: { jobId: booking.reminderJobId, status: "PENDING" },
      data: { status: "COMPLETED", processedAt: new Date() },
    });

    // Clear the job ID from the booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: { reminderJobId: null },
    });

    return true;
  } catch (err: any) {
    logger.warn({ err: err.message, bookingId }, "Failed to cancel reminder job");
    return false;
  }
}

export async function enqueueExtraction(job: ExtractionJob, delayMs?: number): Promise<boolean> {
  const q = getExtractionQueue();
  const jobId = `extract:${job.callId}`;

  if (!q) {
    logger.error({ job }, "Redis unavailable — storing extraction in DB for later replay.");
    await storePendingJob("extraction", job, jobId, delayMs ?? 0);
    return false;
  }

  await q.add(jobId, job, { delay: delayMs ?? 0 });
  return true;
}

export interface WebhookRetryJob {
  payload: Record<string, unknown>;
  retryCount: number;
}

export async function enqueueWebhookRetry(payload: Record<string, unknown>, delayMs: number = 2000) {
  const q = getWebhookRetryQueue();
  if (!q) { logger.warn({}, "Redis unavailable — webhook retry not queued"); return; }
  return q.add(
    `webhook-retry:${payload.call_sid || payload.call_id || Date.now()}`,
    { payload, retryCount: 0 } as WebhookRetryJob,
    { delay: delayMs }
  );
}

export async function enqueueCampaignEmail(job: CampaignEmailJob, delayMs?: number): Promise<boolean> {
  const q = getEmailCampaignQueue();
  if (!q) {
    logger.error({ job }, "Redis unavailable — campaign email NOT queued!");
    return false;
  }
  await q.add(
    `campaign:${job.campaignId}:${job.leadId}`,
    job,
    { delay: delayMs ?? 0 }
  );
  return true;
}

export async function enqueueCampaignWinnerCheck(job: CampaignWinnerCheckJob, delayMs: number): Promise<boolean> {
  const q = getEmailCampaignQueue();
  if (!q) {
    logger.error({ job }, "Redis unavailable — campaign winner check NOT queued!");
    return false;
  }
  await q.add(
    `campaign-winner:${job.campaignId}`,
    job,
    { delay: delayMs }
  );
  return true;
}

export async function closeAllQueues() {
  const queues = [_callQueue, _notificationQueue, _followupQueue, _reminderQueue, _extractionQueue, _webhookRetryQueue, _emailCampaignQueue].filter(Boolean) as Queue[];
  await Promise.all(queues.map((q) => q.close()));
}

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
  if (!q) {
    logger.error({ job }, "Redis unavailable — call NOT queued! Purchased leads will not be called.");
    return false;
  }
  await q.add(
    `call:${job.leadId}:${job.callType}:${job.attempt}`,
    job,
    { delay: delayMs ?? 0 }
  );
  return true;
}

export async function enqueueNotification(job: NotificationJob, delayMs?: number): Promise<boolean> {
  const q = getNotificationQueue();
  if (!q) {
    logger.error({ job }, "Redis unavailable — notification NOT queued! Critical alerts will not be delivered.");
    return false;
  }
  await q.add(
    `notify:${job.type}:${job.leadId}`,
    job,
    { delay: delayMs ?? 0 }
  );
  return true;
}

export async function enqueueFollowup(job: FollowupJob, delayMs?: number): Promise<boolean> {
  const q = getFollowupQueue();
  if (!q) {
    logger.error({ job }, "Redis unavailable — followup NOT queued! Follow-up sequence will not run.");
    return false;
  }
  await q.add(
    `followup:D${job.day}:${job.leadId}`,
    job,
    { delay: delayMs ?? 0 }
  );
  return true;
}

export async function enqueueReminder(job: ReminderJob, delayMs?: number): Promise<boolean> {
  const q = getReminderQueue();
  if (!q) {
    logger.error({ job }, "Redis unavailable — reminder NOT queued! Booking reminders will not be sent.");
    return false;
  }
  await q.add(
    `reminder:${job.bookingId}`,
    job,
    { delay: delayMs ?? 0 }
  );
  return true;
}

export async function enqueueExtraction(job: ExtractionJob, delayMs?: number): Promise<boolean> {
  const q = getExtractionQueue();
  if (!q) {
    logger.error({ job }, "Redis unavailable — extraction NOT queued! Posts-call analysis will not run.");
    return false;
  }
  await q.add(
    `extract:${job.callId}`,
    job,
    { delay: delayMs ?? 0 }
  );
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

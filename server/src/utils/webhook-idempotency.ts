/**
 * Webhook Idempotency Utility.
 *
 * Prevents duplicate processing of the same webhook event.
 * Uses a Redis-based dedup set with TTL-based expiry.
 *
 * Usage:
 *   if (await isDuplicate(fastify, "omnidimension", callLogId)) {
 *     return reply.status(200).send({ received: true, duplicate: true });
 *   }
 *   await markProcessed(fastify, "omnidimension", callLogId, 300);
 */

import { FastifyInstance } from "fastify";

const IDEMPOTENCY_PREFIX = "webhook:processed";
const DEFAULT_TTL_SECONDS = 300; // 5 minutes — covers retry window

/**
 * Check if a webhook event has already been processed.
 * Uses Redis SET with NX + EX to atomically check-and-set.
 *
 * @returns true if this event was already processed (duplicate)
 */
export async function isDuplicate(
  fastify: FastifyInstance,
  source: string,
  eventId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<boolean> {
  try {
    const key = `${IDEMPOTENCY_PREFIX}:${source}:${eventId}`;
    const redis = (fastify as any).redis as import("ioredis").Redis | undefined;

    if (!redis) {
      // No Redis — skip dedup (best-effort)
      return false;
    }

    // SET NX returns "OK" if key was set, null if already exists
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    return result === null; // null means key already existed → duplicate
  } catch {
    // Idempotency check failure should never block processing
    return false;
  }
}

/**
 * Explicitly mark a webhook event as processed.
 * Use this when isDuplicate is not suitable (e.g., you need to
 * mark after successful processing only).
 */
export async function markProcessed(
  fastify: FastifyInstance,
  source: string,
  eventId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    const key = `${IDEMPOTENCY_PREFIX}:${source}:${eventId}`;
    const redis = (fastify as any).redis as import("ioredis").Redis | undefined;
    if (redis) {
      await redis.set(key, "1", "EX", ttlSeconds);
    }
  } catch {
    // Silent — best-effort
  }
}

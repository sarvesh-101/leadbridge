/**
 * Distributed Lock Utility — prevents race conditions in concurrent requests.
 *
 * Uses Redis SET NX with TTL to implement a simple distributed lock.
 * This is used by the lead ingestion webhook to prevent creating duplicate
 * leads when two requests for the same phone arrive simultaneously.
 *
 * Usage:
 *   import { tryAcquireLock, releaseLock } from "../utils/distributed-lock";
 *
 *   const lockId = `dedup:${clientId}:${phone}`;
 *   const acquired = await tryAcquireLock(fastify, lockId, 5);
 *   try {
 *     if (acquired) {
 *       // Critical section — only one request enters here
 *     }
 *   } finally {
 *     if (acquired) await releaseLock(fastify, lockId);
 *   }
 */

import { FastifyInstance } from "fastify";

const LOCK_PREFIX = "lock:";

/**
 * Try to acquire a distributed lock.
 *
 * @param fastify   - Fastify instance with `redis` decorator
 * @param lockId    - Unique lock identifier (e.g. "dedup:client123:+919876543210")
 * @param ttlSeconds- How long the lock lives (auto-released after this)
 * @returns true if the lock was acquired, false if another process holds it
 */
export async function tryAcquireLock(
  fastify: FastifyInstance,
  lockId: string,
  ttlSeconds: number = 5
): Promise<boolean> {
  try {
    const redis = (fastify as any).redis as
      | { set: (key: string, value: string, mode: string, ttl: number, flag: string) => Promise<string | null> }
      | undefined;

    if (!redis) {
      // No Redis — optimistic fallback (best-effort dedup)
      return true;
    }

    const key = `${LOCK_PREFIX}${lockId}`;
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch {
    // Lock failure should never block lead creation
    return true;
  }
}

/**
 * Release a previously acquired lock.
 *
 * @param fastify - Fastify instance with `redis` decorator
 * @param lockId  - The lock identifier used in tryAcquireLock
 */
export async function releaseLock(
  fastify: FastifyInstance,
  lockId: string
): Promise<void> {
  try {
    const redis = (fastify as any).redis as { del: (key: string) => Promise<number> } | undefined;
    if (redis) {
      await redis.del(`${LOCK_PREFIX}${lockId}`);
    }
  } catch {
    // Best-effort — lock will expire via TTL anyway
  }
}

/**
 * Cron Distributed Lock — prevents duplicate cron side-effects when more than
 * one server instance is running (Render scaling, Docker Compose, Railway).
 *
 * Email-sending / state-changing crons (dunning, monthly report, usage alerts…)
 * must only run once per scheduled tick. This wraps a job in a Redis SET NX
 * lock that auto-expires, so a second instance skips the tick instead of
 * double-sending.
 *
 * Fail-open: if Redis is unavailable the job still runs (matching the app-wide
 * convention that Redis outage degrades rather than hard-blocks).
 */
import Redis from "ioredis";
import { config } from "../config";
import { logger } from "./logger";
import {
  getSharedRedisOptions,
  isRedisBackedOff,
  noteRedisError,
  onRedisRecovered,
} from "./redis-health";

let sharedClient: Redis | null | undefined;

async function getClient(): Promise<Redis | null> {
  if (sharedClient !== undefined) return sharedClient;

  // While a quota/auth backoff is active, skip creating the client entirely —
  // every AUTH attempt against an exhausted Upstash instance just spams errors.
  if (isRedisBackedOff()) return null;

  try {
    const client = new Redis(config.REDIS_URL, {
      ...getSharedRedisOptions(),
      lazyConnect: true,
    });
    client.on("error", (err) => {
      noteRedisError(err);
      /* other connection errors are handled by the caller below */
    });
    await client.connect();
    sharedClient = client;
    return client;
  } catch {
    sharedClient = null;
    return null;
  }
}

/**
 * Run `fn` only if no other instance is currently running the same cron tick.
 * Returns the job result, or null when the lock was held by another instance.
 */
export async function runWithCronLock<T>(
  name: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  // Quota/auth backoff active → skip the lock (fail-open, job still runs).
  if (isRedisBackedOff()) {
    logger.warn({ job: name }, "Cron lock skipped — Redis backoff active");
    return fn();
  }

  const client = await getClient();

  if (client) {
    try {
      const ok = await client.set(`cron_lock:${name}`, "1", "EX", ttlSeconds, "NX");
      if (ok !== "OK") {
        logger.info({ job: name }, "Cron tick skipped — another instance holds the lock");
        return null;
      }
    } catch (err: any) {
      logger.warn({ job: name, err: err.message }, "Cron lock unavailable — running without lock");
    }
  } else {
    logger.warn({ job: name }, "Cron lock skipped — Redis unavailable");
  }

  try {
    return await fn();
  } finally {
    if (client) {
      try {
        await client.del(`cron_lock:${name}`);
      } catch {
        // Lock will expire via TTL — best effort
      }
    }
  }
}

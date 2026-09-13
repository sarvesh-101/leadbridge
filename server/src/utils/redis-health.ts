/**
 * Redis Health — Upstash quota awareness + reconnect backoff.
 *
 * Background: on the Upstash free tier, the account has a hard monthly
 * command quota (e.g. 500,000 commands). When exhausted, Upstash rejects
 * every command (including AUTH) with:
 *   ERR max requests limit exceeded
 * Until the quota resets (monthly) or the plan is upgraded, EVERY reconnect
 * attempt burns zero quota but floods the Render logs and churns connections.
 *
 * This module provides:
 *  1. `noteRedisError(msg)` — pattern-matches quota/auth errors and starts a
 *     GLOBAL backoff window. While backed off, no new connections are made.
 *     Backoff is scheduled to the top of the next hour (quota does not
 *     reset mid-hour; retrying hourly is cheap and bounded to ~720/month).
 *  2. `isRedisBackedOff()` / `getRedisBackoffRemainingMs()` — sync checks so
 *     enqueue/cron/lock paths can skip Redis work without any command cost.
 *  3. `getSharedRedisOptions()` — shared ioredis/BullMQ connection options:
 *     exponential reconnect backoff (1s→32s), 10s connect timeout, 300s
 *     server-side keepalive so idle connections aren't killed silently.
 *  4. `probeRedis()` — a single dedicated client used as the ONLY place that
 *     attempts reconnect while backed off. When a probe succeeds (quota back
 *     or transient outage over), the global backoff clears.
 *  5. `onRedisRecovered(cb)` — callbacks fired once when the probe succeeds,
 *     used to re-enable BullMQ queues after an outage.
 */

import Redis from "ioredis";
import { config } from "../config";
import { logger } from "./logger";

// ─── Backoff state (global to the process) ─────────────────────
let backoffUntil = 0;
let backoffReason: string | null = null;
const recoveryCallbacks: Array<() => void> = [];

const QUOTA_PATTERNS = [
  /max requests limit exceeded/i, // Upstash monthly command quota
  /quota/i,
];

const AUTH_PATTERNS = [
  /invalid password/i,
  /wrongpass/i,
  /authentication required/i, // AUTH before quota check → same backoff
  /denied/i,
];

function matchesAny(msg: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(msg));
}

/**
 * Call with every Redis/queue error message. If it's a quota/auth failure,
 * start (or extend) the global backoff window. Safe to call from any thread
 * of the process; errors that don't match are ignored.
 */
export function noteRedisError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (!msg) return;

  const isQuota = matchesAny(msg, QUOTA_PATTERNS);
  const isAuth = matchesAny(msg, AUTH_PATTERNS);
  if (!isQuota && !isAuth) return;

  const now = Date.now();
  if (now < backoffUntil) return; // already backed off

  // Backoff until the top of the next hour. Upstash quota counters don't
  // recover mid-hour, so probing hourly is both bounded (~720 probes/month)
  // and cheap (1 PING each).
  const nextHour = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  backoffUntil = nextHour.getTime();
  backoffReason = isQuota ? "upstash-quota" : "auth-failure";

  logger.error(
    { reason: backoffReason, retryAt: new Date(backoffUntil).toISOString() },
    "REDIS QUOTA/AUTH FAILURE — global backoff engaged, all Redis connections disabled until retry window"
  );

  scheduleProbe();
}

/** True while the global backoff window is active. */
export function isRedisBackedOff(): boolean {
  return Date.now() < backoffUntil;
}

/** Milliseconds remaining in the backoff window (0 if not backing off). */
export function getRedisBackoffRemainingMs(): number {
  return Math.max(0, backoffUntil - Date.now());
}

/** Reason for the current backoff window, or null. */
export function getRedisBackoffReason(): string | null {
  return isRedisBackedOff() ? backoffReason : null;
}

/**
 * Register a callback fired once when Redis is confirmed working again
 * (probe success after backoff). Used to re-enable BullMQ queues.
 */
export function onRedisRecovered(cb: () => void): void {
  recoveryCallbacks.push(cb);
}

function fireRecoveryCallbacks(): void {
  for (const cb of recoveryCallbacks) {
    try {
      cb();
    } catch (err: any) {
      logger.warn({ err: err.message }, "redis-recovery callback failed");
    }
  }
}

// ─── Shared connection options ─────────────────────────────────
// Every ioredis client + BullMQ connection in the app should use these so a
// Redis outage results in 1s→32s exponential reconnects instead of a
// per-millisecond reconnect storm.

/**
 * The reconnect strategy shared by all Redis clients.
 * Returns null (stop) while the global backoff is active.
 */
export function sharedRetryStrategy(times: number): number | null {
  if (isRedisBackedOff()) return null; // hard stop while backed off
  return Math.min(times * 1000, 32_000); // 1s, 2s, 4s … capped at 32s
}

/**
 * Baseline options for ioredis clients and BullMQ connections.
 * Callers may override individual fields (e.g. enableReadyCheck).
 */
export function getSharedRedisOptions(): {
  maxRetriesPerRequest: null;
  connectTimeout: number;
  keepAlive: number;
  retryStrategy: typeof sharedRetryStrategy;
} {
  return {
    maxRetriesPerRequest: null,
    connectTimeout: 10_000,
    keepAlive: 300_000,
    retryStrategy: sharedRetryStrategy,
  };
}

// ─── Dedicated probe client ────────────────────────────────────
// The ONLY client allowed to reconnect while backed off. One PING per hour
// tells us when the quota reset or the plan was upgraded.

let probeClient: Redis | null = null;
let probeScheduled = false;

function scheduleProbe(): void {
  if (probeScheduled) return;
  probeScheduled = true;

  const delay = Math.max(5_000, getRedisBackoffRemainingMs() + 1_000);
  setTimeout(() => {
    probeScheduled = false;
    void runProbe();
  }, delay).unref();
}

async function runProbe(): Promise<void> {
  if (!isRedisBackedOff()) return;

  try {
    if (!probeClient) {
      probeClient = new Redis(config.REDIS_URL, {
        ...getSharedRedisOptions(),
        lazyConnect: true,
        retryStrategy: (times) => {
          // Probe-specific: don't fight the global backoff; one attempt per
          // scheduled probe is enough.
          return times <= 1 ? 500 : null;
        },
      });
      probeClient.on("error", () => {
        /* handled via catch below */
      });
    }

    await probeClient.connect();

    const res = await probeClient.ping();
    if (res === "PONG") {
      // Quota is back (or was a transient auth issue that's now fixed).
      const wasBackedOff = backoffReason;
      backoffUntil = 0;
      backoffReason = null;
      logger.info(
        { previousReason: wasBackedOff },
        "REDIS PROBE SUCCEEDED — backoff cleared, re-enabling Redis consumers"
      );
      try {
        await probeClient.quit();
      } catch {
        /* ignore */
      }
      probeClient = null;
      fireRecoveryCallbacks();
      return;
    }
  } catch (err: any) {
    // Still failing — reschedule for the next hour.
    logger.warn(
      { err: err.message },
      "REDIS PROBE FAILED — still backed off, next probe in ~1h"
    );
    try {
      if (probeClient) {
        probeClient.disconnect();
      }
    } catch {
      /* ignore */
    }
  }

  scheduleProbe();
}

/** Test/export hook — reset all state between tests. */
export function resetRedisHealthForTests(): void {
  backoffUntil = 0;
  backoffReason = null;
  recoveryCallbacks.length = 0;
  if (probeClient) {
    try {
      probeClient.disconnect();
    } catch {
      /* ignore */
    }
    probeClient = null;
  }
  probeScheduled = false;
}

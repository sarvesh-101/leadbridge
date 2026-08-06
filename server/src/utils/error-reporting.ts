/**
 * Error Reporting — lightweight, env-gated Sentry integration.
 *
 * Sends captured errors to Sentry via the raw HTTP Envelope API (no SDK needed).
 * If SENTRY_DSN is NOT set, all functions are safe no-ops — the app never
 * depends on Sentry being configured.
 *
 * DSN format: https://<publicKey>@<host>/<projectId>
 *
 * Usage:
 *   import { reportError } from "../utils/error-reporting";
 *   reportError(new Error("boom"), { context: "my-service" });
 */

import crypto from "node:crypto";
import { logger } from "./logger";

interface ReportContext {
  [key: string]: unknown;
}

let sentryConfig: { host: string; publicKey: string; projectId: string } | null | undefined;

function getSentryConfig(): { host: string; publicKey: string; projectId: string } | null {
  if (sentryConfig !== undefined) return sentryConfig;

  const dsn = process.env.SENTRY_DSN || "";
  const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
  if (!match) {
    sentryConfig = null;
    return null;
  }

  sentryConfig = {
    publicKey: match[1],
    host: match[2],
    projectId: match[3],
  };
  return sentryConfig;
}

/**
 * Send an error event to Sentry. Safe no-op when SENTRY_DSN is unset.
 * Never throws — errors here are logged and swallowed.
 */
export async function reportError(error: Error | unknown, context: ReportContext = {}): Promise<void> {
  const cfg = getSentryConfig();
  if (!cfg) return; // Not configured — no-op

  const eventId = crypto.randomUUID().replace(/-/g, "");

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const eventBody = JSON.stringify({
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: "node",
    message,
    level: "error",
    exception: error instanceof Error
      ? {
          values: [
            {
              type: error.name || "Error",
              value: error.message,
              stacktrace: stack ? { frames: [] } : undefined,
            },
          ],
        }
      : undefined,
    contexts: {
      runtime: {
        name: "node",
        version: process.versions?.node || "unknown",
      },
      report: context,
    },
  });

  const envelope = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event", length: Buffer.byteLength(eventBody), content_type: "application/json" }),
    eventBody,
  ].join("\n");

  try {
    const res = await fetch(`https://${cfg.host}/api/${cfg.projectId}/envelope/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=leadbridge/1.0.0, sentry_key=${cfg.publicKey}`,
      },
      body: envelope,
    });
    if (!res.ok) {
      logger.warn({ status: res.status, eventId }, "Sentry report failed (non-fatal)");
    }
  } catch (err: any) {
    // Never let error reporting break the app
    logger.warn({ err: err.message }, "Sentry report threw (non-fatal)");
  }
}

/**
 * Convenience wrapper that reports and logs an error in one step.
 */
export function captureError(error: Error | unknown, context: ReportContext = {}): void {
  reportError(error, context).catch(() => {});
  logger.error(
    {
      err: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    },
    "Error captured"
  );
}

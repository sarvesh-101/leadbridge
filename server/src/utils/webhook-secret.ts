/**
 * Shared-secret auth for inbound provider webhooks.
 *
 * The email webhook URL is public by necessity — the provider has to reach it —
 * and a forged POST creates leads, which means billable AI calls. So when
 * `EMAIL_WEBHOOK_SECRET` is set, every request must present it. When it is unset
 * the route keeps its old open behaviour, which lets this ship safely *before*
 * the provider is configured.
 *
 * Providers present credentials in different ways, so the same secret is
 * accepted from:
 *   - `X-Webhook-Secret` / `X-Cloudmailin-Secret` header (preferred)
 *   - `Authorization: Bearer <secret>`
 *   - HTTP Basic auth, with the secret as the password (CloudMailin style)
 *   - `?secret=`, `?key=` or `?token=` on the target URL (last resort; URLs leak
 *     into provider dashboards and proxy logs)
 */
import { createHash, timingSafeEqual } from "node:crypto";

export type HeaderBag = Record<string, string | string[] | undefined>;

function firstHeader(headers: HeaderBag, name: string): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Constant-time compare; hashing first keeps the buffers the same length. */
export function secretMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function presentedSecret(
  headers: HeaderBag,
  query?: Record<string, unknown>,
): string | null {
  const direct = firstHeader(headers, "x-webhook-secret") ?? firstHeader(headers, "x-cloudmailin-secret");
  if (direct) return direct;

  const auth = firstHeader(headers, "authorization");
  if (auth) {
    const bearer = /^Bearer\s+(.+)$/i.exec(auth);
    if (bearer) return bearer[1].trim();

    const basic = /^Basic\s+(\S+)$/i.exec(auth);
    if (basic) {
      const decoded = Buffer.from(basic[1], "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        // CloudMailin (and friends) put the secret in the password half.
        const password = decoded.slice(separator + 1);
        return password || decoded.slice(0, separator) || null;
      }
      return decoded || null;
    }
  }

  for (const key of ["secret", "key", "token"]) {
    const value = query?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * True when the request may proceed. Unset/blank `expected` means the endpoint
 * is intentionally unauthenticated (pre-provider deployments, local testing).
 */
export function isWebhookRequestAuthorized(opts: {
  headers: HeaderBag;
  query?: Record<string, unknown>;
  expected: string | undefined;
}): boolean {
  const expected = (opts.expected || "").trim();
  if (!expected) return true;
  const provided = presentedSecret(opts.headers, opts.query);
  return !!provided && secretMatches(provided, expected);
}

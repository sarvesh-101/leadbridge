/**
 * Signed Asset URL Utility — short-lived, tamper-proof links to sensitive files.
 *
 * Used to protect generated invoice PDFs (they contain broker PII) that are
 * opened directly in a new tab via a plain <a href> (no Authorization header).
 * A link is signed with HMAC-SHA256 over `<path>:<expiry>` and stays valid for
 * SIGNED_URL_TTL_MS, long enough to download/print but not to be shared forever.
 */
import crypto from "node:crypto";
import { config } from "../config";

const SIGNED_URL_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Append an expiry + HMAC signature to an asset path. */
export function signAssetUrl(path: string): string {
  if (!path) return path;
  const exp = Date.now() + SIGNED_URL_TTL_MS;
  const sig = crypto.createHmac("sha256", config.JWT_SECRET)
    .update(`${path}:${exp}`)
    .digest("hex");
  return `${path}?exp=${exp}&sig=${sig}`;
}

/**
 * Verify a signed asset URL.
 * @param pathname the request path WITHOUT query string (e.g. "/invoices/INV-1.pdf")
 * @param query    parsed query params (exp, sig)
 */
export function verifySignedAssetUrl(
  pathname: string,
  query: { exp?: string; sig?: string }
): boolean {
  const { exp, sig } = query;
  if (!exp || !sig) return false;

  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  const expected = crypto.createHmac("sha256", config.JWT_SECRET)
    .update(`${pathname}:${expiry}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(sig);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

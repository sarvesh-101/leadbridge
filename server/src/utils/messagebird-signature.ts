/**
 * MessageBird webhook signature validation.
 *
 * MessageBird signs webhook requests with the `X-MessageBird-Signature` header:
 *   signature = base64(HMAC-SHA256(requestBody, signingKey))
 *
 * Per MessageBird docs the signing key is the webhook token; we accept EITHER
 * the request's `token` query parameter or MESSAGEBIRD_API_KEY as the key so
 * dashboard configuration doesn't need to match exactly. Without a valid
 * signature the caller must fail closed.
 */
import crypto from "node:crypto";

/** base64(HMAC-SHA256(rawBody, key)) per MessageBird's documented scheme. */
export function computeMessageBirdSignature(rawBody: string, key: string): string {
  return crypto.createHmac("sha256", key).update(rawBody).digest("base64");
}

function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Returns true when the header matches a signature computed with any of the
 * candidate keys (query token, then the API key).
 */
export function validMessageBirdSignature(
  rawBody: string,
  queryToken: string | undefined,
  header: string | undefined,
  apiKey: string | undefined
): boolean {
  if (!header || !apiKey) return false;

  const candidates: string[] = [];
  if (queryToken) candidates.push(queryToken);
  candidates.push(apiKey);

  for (const key of candidates) {
    const computed = computeMessageBirdSignature(rawBody, key);
    if (constantTimeEqual(Buffer.from(computed), Buffer.from(header))) {
      return true;
    }
  }
  return false;
}
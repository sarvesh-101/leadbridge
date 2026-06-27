/**
 * WhatsApp Rate Limiter — per-recipient throttling.
 *
 * Meta's WhatsApp Cloud API enforces rate limits per phone number.
 * This prevents the notification worker from sending too many messages
 * to the same recipient in a short time window.
 *
 * Limits:
 *   - Business accounts: ~1 message per second per phone number (industry standard)
 *   - We use a conservative 1.5s gap between messages to the same recipient
 *
 * Usage:
 *   import { canSendToRecipient, WAIT_TOKEN } from "../utils/whatsapp-rate-limiter";
 *
 *   // Before sending, await the token (blocks until rate limit allows)
 *   await WAIT_TOKEN;
 */

const recipientTimestamps = new Map<string, number>();
const MIN_GAP_MS = 1500; // 1.5 seconds between messages to same recipient

/**
 * Wait until the rate limiter allows sending a message to this recipient.
 * Returns a promise that resolves when it's safe to send.
 *
 * @param phoneNumber - Recipient's phone number in E.164 format
 * @returns A promise that resolves when it's OK to send
 */
export async function canSendToRecipient(phoneNumber: string): Promise<void> {
  const lastSent = recipientTimestamps.get(phoneNumber);
  const now = Date.now();

  if (lastSent) {
    const timeSinceLastSend = now - lastSent;
    if (timeSinceLastSend < MIN_GAP_MS) {
      const waitTime = MIN_GAP_MS - timeSinceLastSend;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  recipientTimestamps.set(phoneNumber, Date.now());
}

/**
 * Clear rate limiter state (useful for testing or reset).
 */
export function resetRateLimiter(): void {
  recipientTimestamps.clear();
}

/**
 * Get the current number of tracked recipients.
 */
export function getTrackedRecipientsCount(): number {
  return recipientTimestamps.size;
}

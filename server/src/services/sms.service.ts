/**
 * SMS Service — fallback notification channel for when WhatsApp is unavailable.
 *
 * Uses MessageBird (Bird) for transactional SMS delivery in India.
 * When WhatsApp sendTextMessage() fails, we fall back to SMS for critical alerts:
 *   - Booking confirmations
 *   - Booking day reminders
 *   - No-show alerts
 *   - Cold lead notifications
 *   - Follow-up results
 *
 * Environment:
 *   MESSAGEBIRD_API_KEY  (required for SMS fallback to work)
 *   SMS_SENDER_ID        (optional, default "LeadBrg" — 8 chars max for India)
 */

import { logger } from "../utils/logger";
import { config } from "../config";

/** Minimal shape of MessageBird API response */
interface MessageBirdResponse {
  id: string;
  status: string;
  recipients?: { totalCount?: number; totalDeliveredCount?: number };
}

/**
 * Send an SMS via MessageBird.
 *
 * @param to   - Recipient phone number in E.164 format (e.g. +919876543210)
 * @param text - Message body (max 765 characters for a single SMS; longer will be concatenated)
 * @returns true if the SMS was sent successfully, false otherwise
 */
export async function sendSms(to: string, text: string): Promise<boolean> {
  if (!config.MESSAGEBIRD_API_KEY) {
    logger.warn({ to }, "MESSAGEBIRD_API_KEY not configured — SMS not sent");
    return false;
  }

  try {
    // Dynamic import — MessageBird's SDK uses callback pattern, wrap in Promise
    const messagebird = await import("messagebird");
    // The SDK exports differently across versions; try both patterns
    const Client = (messagebird as any).Client || (messagebird as any).default?.Client || messagebird;
    const client = new Client(config.MESSAGEBIRD_API_KEY);

    const response = await new Promise<MessageBirdResponse>((resolve, reject) => {
      client.message.create(
        {
          originator: config.SMS_SENDER_ID || "LeadBrg",
          recipients: [to.replace(/\D/g, "")],
          body: text.substring(0, 765),
        },
        (err: Error | null, res: MessageBirdResponse) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });

    logger.info(
      { to, messageId: response.id, status: response.status },
      "SMS sent via MessageBird"
    );
    return true;
  } catch (error: any) {
    logger.error(
      { err: error.message, to },
      "MessageBird SMS send failed"
    );
    return false;
  }
}

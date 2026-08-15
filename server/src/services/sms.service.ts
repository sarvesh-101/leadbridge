/**
 * SMS Service — fallback notification channel for when WhatsApp is unavailable.
 *
 * Uses Bird (formerly MessageBird) for transactional SMS delivery in India.
 * When WhatsApp sendTextMessage() fails, we fall back to SMS for critical alerts:
 *   - Booking confirmations
 *   - Booking day reminders
 *   - No-show alerts
 *   - Cold lead notifications
 *   - Follow-up results
 *   - Customer portal OTPs
 *   - Payment links
 *
 * Environment:
 *   MESSAGEBIRD_API_KEY  (required for SMS fallback to work) — new-format
 *                        `bk_<region>_...` access keys supported.
 *   SMS_SENDER_ID        (optional, default "LeadBrg") — legacy field; the new
 *                        platform API handles the sender on its side.
 *
 * NOTE (2026-08-12): the `messagebird` npm SDK targets the OLD API
 * (rest.messagebird.com, `AccessKey` auth) which rejects new `bk_` keys.
 * This service now calls Bird's NEW platform API directly over HTTPS with
 * `Authorization: Bearer <key>` — see https://developers.bird.com.
 */

import { logger } from "../utils/logger";
import { config } from "../config";

/** Minimal shape of the new Bird API send response */
interface BirdSendResponse {
  id: string;
  status: string;
  message?: string;
  error?: { code?: string; message?: string };
}

/**
 * Resolve the regional platform host from the access key prefix.
 * bk_eu1_ → eu1.platform.bird.com, bk_us1_ → us1.platform.bird.com,
 * anything else → api.bird.com (generic).
 */
function resolveHost(apiKey: string): string {
  if (apiKey.startsWith("bk_us1_")) return "us1.platform.bird.com";
  if (apiKey.startsWith("bk_eu1_")) return "eu1.platform.bird.com";
  return "api.bird.com";
}

/**
 * Send an SMS via Bird's new platform API.
 *
 * @param to   - Recipient phone number (E.164 or any format — digits are normalized to +<country><number>)
 * @param text - Message body (max 765 characters for a single SMS; longer will be concatenated)
 * @returns true if the SMS was accepted by the API, false otherwise
 */
export async function sendSms(to: string, text: string): Promise<boolean> {
  if (!config.MESSAGEBIRD_API_KEY) {
    logger.warn({ to }, "MESSAGEBIRD_API_KEY not configured — SMS not sent");
    return false;
  }

  const apiKey = config.MESSAGEBIRD_API_KEY;
  // The new Bird API wants E.164 (e.g. +917045525531) — digits are already
  // in full international form since all our stored numbers are +91…
  const e164To = `+${to.replace(/\D/g, "")}`;

  const url = `https://${resolveHost(apiKey)}/v1/sms/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: e164To,
        text: text.substring(0, 765),
        // Category drives DLT/template handling on Bird's side.
        category: "transactional",
      }),
    });

    const data = (await res.json().catch(() => ({}))) as BirdSendResponse;

    if (res.ok && data.id) {
      logger.info({ to, messageId: data.id, status: data.status }, "SMS sent via Bird");
      return true;
    }

    // Surface the actionable error (e.g. SMSDestinationNotEnabled) in logs
    logger.error(
      { to, status: res.status, error: data.error?.code || data.message || "unknown" },
      "Bird SMS send failed"
    );
    return false;
  } catch (error: any) {
    logger.error({ err: error.message, to }, "Bird SMS send failed (network)");
    return false;
  }
}

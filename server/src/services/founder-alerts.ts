/**
 * V2 (T7) — founder alerts (platform credit events, cost-per-lead breaches).
 *
 * Email is the durable channel; WhatsApp is best-effort. Both destinations are
 * env-driven (FOUNDER_ALERT_EMAIL / FOUNDER_ALERT_WHATSAPP) and the call is a
 * no-op when neither is configured — never invent a recipient.
 */
import { config } from "../config";
import { logger } from "../utils/logger";
import { sendEmail } from "./email.service";

export async function alertFounder(subject: string, text: string): Promise<{ email: boolean; whatsapp: boolean }> {
  let email = false;
  let whatsapp = false;

  if (config.FOUNDER_ALERT_EMAIL) {
    try {
      email = await sendEmail({ to: config.FOUNDER_ALERT_EMAIL, subject: `[Converza] ${subject}`, text });
    } catch (err: any) {
      logger.warn({ err: err.message }, "Founder email alert failed");
    }
  }

  if (config.FOUNDER_ALERT_WHATSAPP) {
    try {
      const { sendTextMessage } = await import("./whatsapp.service");
      const id = await sendTextMessage({
        to: config.FOUNDER_ALERT_WHATSAPP,
        text: `${subject}\n\n${text}`,
        recipientType: "owner",
      });
      whatsapp = Boolean(id);
    } catch (err: any) {
      logger.warn({ err: err.message }, "Founder WhatsApp alert failed");
    }
  }

  if (!email && !whatsapp) {
    logger.warn({ subject }, "Founder alert not delivered — FOUNDER_ALERT_EMAIL/FOUNDER_ALERT_WHATSAPP unset");
  }

  return { email, whatsapp };
}

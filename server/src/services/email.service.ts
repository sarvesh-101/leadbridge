/**
 * Email Notification Service — third notification channel using Resend.
 *
 * Used as a secondary fallback (after WhatsApp → SMS) for critical alerts:
 * - Booking confirmations
 * - No-show alerts
 * - Monthly reports (already uses Resend directly)
 * - Trial expiry (already uses Resend directly)
 *
 * Environment:
 *   RESEND_API_KEY  (required for email to work)
 *   FROM_EMAIL      (sender address, default "noreply@leadbridge.com")
 */

import { config } from "../config";
import { logger } from "../utils/logger";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send a transactional email via Resend API.
 *
 * @returns true if the email was sent successfully, false otherwise
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!config.RESEND_API_KEY) {
    logger.warn({ to: params.to }, "RESEND_API_KEY not configured — email not sent");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `LeadBridge <${config.FROM_EMAIL}>`,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        { err: errorBody, to: params.to, subject: params.subject },
        "Resend email send failed"
      );
      return false;
    }

    const data = (await response.json()) as { id: string };
    logger.info(
      { to: params.to, emailId: data.id, subject: params.subject },
      "Email sent via Resend"
    );
    return true;
  } catch (error: any) {
    logger.error(
      { err: error.message, to: params.to },
      "Resend email request failed"
    );
    return false;
  }
}

/**
 * Send a booking confirmation email to both customer and owner.
 */
export async function sendBookingConfirmationEmail(params: {
  customerEmail?: string;
  ownerEmail: string;
  customerName: string;
  ownerName: string;
  businessName: string;
  visitDate: string;
  visitTime: string;
  location: string;
}): Promise<{ customerSent: boolean; ownerSent: boolean }> {
  const subject = `🏠 Visit Confirmed: ${params.visitDate} at ${params.visitTime}`;

  const customerText = [
    `Namaste ${params.customerName}!`,
    ``,
    `Your property visit has been confirmed with ${params.businessName}.`,
    ``,
    `Date: ${params.visitDate}`,
    `Time: ${params.visitTime}`,
    `Location: ${params.location}`,
    ``,
    `Please be on time. Contact the broker if you need to reschedule.`,
    ``,
    `— The LeadBridge Team`,
  ].join("\n");

  const ownerText = [
    `Hi ${params.ownerName},`,
    ``,
    `A new visit has been booked:`,
    ``,
    `Customer: ${params.customerName}`,
    `Date: ${params.visitDate}`,
    `Time: ${params.visitTime}`,
    `Location: ${params.location}`,
    ``,
    `— LeadBridge`,
  ].join("\n");

  const [customerSent, ownerSent] = await Promise.all([
    params.customerEmail
      ? sendEmail({ to: params.customerEmail, subject, text: customerText })
      : Promise.resolve(false),
    sendEmail({ to: params.ownerEmail, subject, text: ownerText }),
  ]);

  return { customerSent, ownerSent };
}

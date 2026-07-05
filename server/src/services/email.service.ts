/**
 * Email Notification Service — uses Nodemailer + SMTP with Resend fallback.
 *
 * Primary: SMTP (works with AWS SES, SendGrid, Gmail, Mailgun, any SMTP)
 *   - SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *   - Cost: AWS SES ~$0.10 per 1000 emails ($5/50K)
 *   - Cost: SendGrid $19.95/mo for 50K
 *
 * Fallback: Resend HTTP API (if SMTP not configured)
 *   - RESEND_API_KEY
 *   - Free: 100/day, Paid: $10/mo for 50K
 *
 * Used for:
 *   - Booking confirmations (customer + owner)
 *   - No-show alerts
 *   - Password resets / team invitations
 *   - Monthly reports
 *   - Trial expiry notifications
 */

import nodemailer from "nodemailer";
import { config } from "../config";
import { logger } from "../utils/logger";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (smtpTransporter) return smtpTransporter;

  // SMTP requires at minimum a host and credentials
  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    return null;
  }

  try {
    smtpTransporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
    return smtpTransporter;
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to create SMTP transport");
    return null;
  }
}

const smtpConfigured = (): boolean => {
  return !!(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);
};

const resendConfigured = (): boolean => {
  return !!config.RESEND_API_KEY;
};

/**
 * Send a transactional email.
 * Primary: SMTP (nodemailer). Fallback: Resend HTTP API.
 *
 * @returns true if sent successfully, false otherwise
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!smtpConfigured() && !resendConfigured()) {
    logger.warn(
      { to: params.to },
      "No email provider configured — set SMTP_* vars or RESEND_API_KEY"
    );
    return false;
  }

  // Primary: SMTP via nodemailer
  if (smtpConfigured()) {
    return sendViaSmtp(params);
  }

  // Fallback: Resend HTTP API
  return sendViaResend(params);
}

/**
 * Send via SMTP (nodemailer) — works with AWS SES, SendGrid, Gmail, etc.
 */
async function sendViaSmtp(params: SendEmailParams): Promise<boolean> {
  const transporter = getSmtpTransporter();
  if (!transporter) {
    logger.warn({ to: params.to }, "SMTP not configured — skipping");
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    });

    logger.info(
      { to: params.to, messageId: info.messageId, subject: params.subject },
      "Email sent via SMTP"
    );
    return true;
  } catch (error: any) {
    logger.error(
      { err: error.message, to: params.to, subject: params.subject },
      "SMTP email send failed"
    );

    // If SMTP fails and Resend is available, try Resend as fallback
    if (resendConfigured()) {
      logger.info({ to: params.to }, "Falling back to Resend");
      return sendViaResend(params);
    }

    return false;
  }
}

/**
 * Send via Resend HTTP API (fallback).
 */
async function sendViaResend(params: SendEmailParams): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${config.FROM_NAME} <${config.FROM_EMAIL}>`,
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

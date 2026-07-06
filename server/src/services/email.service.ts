/**
 * Email Notification Service — uses Nodemailer + SMTP.
 *
 * SMTP (works with AWS SES, SendGrid, Gmail, Mailgun, Brevo, any SMTP)
 *   - SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *   - Cost: AWS SES ~$0.10 per 1000 emails ($5/50K, 62K/mo free from EC2)
 *   - Cost: SendGrid $19.95/mo for 50K (100/day free)
 *   - Cost: Brevo 300/day free, Mailgun 1K/day free
 *
 * Used for:
 *   - Booking confirmations (customer + owner)
 *   - No-show alerts
 *   - Password resets / team invitations
 *   - Monthly reports
 *   - Trial expiry notifications
 *   - Email campaigns
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

/**
 * Send a transactional email via SMTP (Nodemailer).
 * Works with AWS SES, SendGrid, Gmail, Mailgun, Brevo, or any SMTP provider.
 *
 * @returns true if sent successfully, false otherwise
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!smtpConfigured()) {
    logger.warn(
      { to: params.to },
      "SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS"
    );
    return false;
  }

  return sendViaSmtp(params);
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

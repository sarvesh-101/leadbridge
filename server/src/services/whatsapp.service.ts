import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * WhatsApp Cloud API service — sends messages to customers and owners.
 * Uses Meta's WhatsApp Business Cloud API.
 */

interface SendMessageParams {
  to: string;
  text: string;
  recipientType: "customer" | "owner";
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

const whatsappApi = axios.create({
  baseURL: `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}`,
  headers: {
    Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/**
 * Send a plain text WhatsApp message.
 * Uses the text body directly — no template approval needed for under-1024-char messages.
 */
export async function sendTextMessage(params: SendMessageParams): Promise<string | null> {
  try {
    const response = await whatsappApi.post<WhatsAppResponse>("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: params.to.replace(/\D/g, ""),
      type: "text",
      text: { body: params.text },
    });

    const messageId = response.data.messages?.[0]?.id || null;
    logger.info(
      { to: params.to, messageId, recipientType: params.recipientType },
      "WhatsApp message sent"
    );

    return messageId;
  } catch (error: any) {
    logger.error(
      { err: error.response?.data?.error?.message || error.message, to: params.to },
      "WhatsApp send failed"
    );
    return null;
  }
}

/**
 * Verify WhatsApp webhook subscription.
 */
export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  if (mode === "subscribe" && token === config.WHATSAPP_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

/**
 * Mark a message as read.
 */
export async function markAsRead(messageId: string): Promise<void> {
  try {
    await whatsappApi.post("/messages", {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  } catch (error: any) {
    logger.error({ messageId, err: error.message }, "Failed to mark message as read");
  }
}

/**
 * V2 (T5/T11) — send an APPROVED WhatsApp template by name.
 *
 * Business-initiated messages must use an approved template; free-form text is
 * only allowed inside an open 24-hour customer service window. When no template
 * is configured the caller must skip and log — never fall back to free-form.
 */
import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

export interface NamedTemplateParams {
  to: string;
  templateName: string;
  languageCode?: string;
  /** Positional body parameters for the approved template. */
  bodyParams?: string[];
}

function e164(to: string): string {
  const digits = to.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return `+91${digits}`;
}

export async function sendNamedTemplate(params: NamedTemplateParams): Promise<boolean> {
  if (!config.WHATSAPP_TOKEN || !config.WHATSAPP_PHONE_ID) {
    logger.warn({ template: params.templateName }, "WhatsApp template skipped — Cloud API not configured");
    return false;
  }
  if (!params.templateName) {
    logger.warn("WhatsApp template skipped — no template name configured");
    return false;
  }

  const components = params.bodyParams?.length
    ? [{ type: "body", parameters: params.bodyParams.map((text) => ({ type: "text", text })) }]
    : undefined;

  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: e164(params.to),
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.languageCode || "en" },
          ...(components ? { components } : {}),
        },
      },
      { headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}` }, timeout: 10_000 }
    );
    return true;
  } catch (err: any) {
    logger.warn(
      { template: params.templateName, status: err.response?.status, err: err.message },
      "WhatsApp template send failed"
    );
    return false;
  }
}

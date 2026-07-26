/**
 * Admin WhatsApp Configuration Route.
 *
 * Provides:
 * - GET /admin/whatsapp/config — Check WhatsApp env var status, webhook URL, connection health
 * - POST /admin/whatsapp/test/send — Send a test message to verify WhatsApp is working
 * - POST /admin/whatsapp/test/webhook — Trigger a simulated webhook event to test Meta callback
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import axios from "axios";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import { sendTextMessage } from "../../services/whatsapp.service";

export default async function adminWhatsAppRoutes(fastify: FastifyInstance) {
  // ─── GET /admin/whatsapp/config — Full WhatsApp configuration status ──
  fastify.get("/admin/whatsapp/config", async (_request: FastifyRequest, reply: FastifyReply) => {
    const webhookUrl = `${config.FRONTEND_URL?.replace(/\/+$/, "") || "https://leadbridge.com"}/api/v1/webhooks/whatsapp`;

    const envVars = {
      WHATSAPP_TOKEN: {
        value: config.WHATSAPP_TOKEN ? maskString(config.WHATSAPP_TOKEN) : null,
        set: !!config.WHATSAPP_TOKEN,
      },
      WHATSAPP_PHONE_ID: {
        value: config.WHATSAPP_PHONE_ID ? maskString(config.WHATSAPP_PHONE_ID) : null,
        set: !!config.WHATSAPP_PHONE_ID,
      },
      WHATSAPP_VERIFY_TOKEN: {
        value: config.WHATSAPP_VERIFY_TOKEN ? maskString(config.WHATSAPP_VERIFY_TOKEN) : null,
        set: !!config.WHATSAPP_VERIFY_TOKEN,
      },
      WHATSAPP_BUSINESS_ACCOUNT_ID: {
        value: config.WHATSAPP_BUSINESS_ACCOUNT_ID ? maskString(config.WHATSAPP_BUSINESS_ACCOUNT_ID) : null,
        set: !!config.WHATSAPP_BUSINESS_ACCOUNT_ID,
      },
    };

    const allConfigured = Object.values(envVars).every((v) => v.set);

    // Try to get live phone number info from Meta if configured
    let phoneInfo: { phoneNumber?: string; name?: string; qualityRating?: string } | null = null;
    if (config.WHATSAPP_TOKEN && config.WHATSAPP_PHONE_ID) {
      try {
        const res = await axios.get(
          `https://graph.facebook.com/v19.0/${config.WHATSAPP_PHONE_ID}`,
          {
            headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}` },
            timeout: 5000,
          }
        );
        phoneInfo = {
          phoneNumber: res.data.display_phone_number || res.data.id,
          name: res.data.verified_name || res.data.name,
          qualityRating: res.data.quality_rating || "unknown",
        };
      } catch (err: any) {
        logger.warn({ err: err.message }, "Failed to fetch WhatsApp phone info from Meta");
      }
    }

    return reply.send({
      configured: allConfigured,
      phoneInfo,
      envVars,
      webhookUrl,
      webhookConfiguredInMeta: false, // Can't verify this from API — manual check
      demoMode: config.DEMO_MODE,
      message: allConfigured
        ? "✅ WhatsApp Cloud API is fully configured. Messages will be sent from your WhatsApp Business number."
        : "⚠️ WhatsApp Cloud API is not fully configured. Set the missing env vars and configure the webhook in Meta.",
      setupGuide: {
        steps: [
          {
            step: 1,
            title: "Create a Meta Business Portfolio",
            description: "Go to business.facebook.com and create a business account. You need this to access WhatsApp Business API.",
            link: "https://business.facebook.com/overview",
            linkLabel: "Open Meta Business Suite",
          },
          {
            step: 2,
            title: "Add WhatsApp Product",
            description: "In your Meta Business Portfolio, go to Settings → Business Assets → Add → WhatsApp Account. Create a new WhatsApp Business Account (WABA).",
            link: "https://business.facebook.com/wa/manage/",
            linkLabel: "Open WhatsApp Manager",
          },
          {
            step: 3,
            title: "Add a Phone Number",
            description: "Register a phone number for WhatsApp Business API. This number CANNOT be registered with any existing WhatsApp account (personal or business app). You can buy a new SIM or use a virtual number.",
            note: "Important: This number must be able to receive SMS or voice calls for verification.",
          },
          {
            step: 4,
            title: "Generate Permanent Token",
            description: "In WhatsApp Manager → API Setup, generate a permanent access token. Copy it to WHATSAPP_TOKEN in your .env file.",
            link: "https://business.facebook.com/wa/manage/",
            linkLabel: "Generate Token",
          },
          {
            step: 5,
            title: "Copy Phone Number ID",
            description: "In WhatsApp Manager, find your phone number ID. Copy it to WHATSAPP_PHONE_ID in your .env file.",
            note: "The Phone Number ID is different from your phone number. It's a numeric ID used in the API.",
          },
          {
            step: 6,
            title: "Set Verify Token",
            description: "Create a random string (e.g., 'leadbridge-verify-2024') and add it as WHATSAPP_VERIFY_TOKEN in your .env file. You'll enter the same string in Meta's webhook configuration.",
          },
          {
            step: 7,
            title: "Configure Webhook in Meta",
            description: `In WhatsApp Manager → Webhook, set the callback URL to:`,
            code: webhookUrl,
            description2: `Set the verify token to the same value as WHATSAPP_VERIFY_TOKEN. Subscribe to: messages, message_deliveries, message_reads.`,
            link: "https://business.facebook.com/wa/manage/webhooks",
            linkLabel: "Configure Webhook",
          },
          {
            step: 8,
            title: "Verify and Test",
            description: "Meta will verify the webhook by sending a GET request. After that, send a test message using the button below to confirm everything works.",
          },
        ],
      },
    });
  });

  // ─── POST /admin/whatsapp/test/send — Send a test WhatsApp message ──
  fastify.post("/admin/whatsapp/test/send", {
    schema: {
      body: {
        type: "object",
        properties: {
          to: { type: "string" },
        },
        required: ["to"],
      },
    },
  }, async (request: FastifyRequest<{ Body: { to: string } }>, reply: FastifyReply) => {
    const { to } = request.body;

    if (!config.WHATSAPP_TOKEN || !config.WHATSAPP_PHONE_ID) {
      return reply.status(400).send({
        error: "WhatsApp not configured",
        message: "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in .env first.",
      });
    }

    if (config.DEMO_MODE) {
      return reply.send({
        success: true,
        demoMode: true,
        message: `[DEMO] Test message would be sent to ${to}`,
      });
    }

    try {
      const result = await sendTextMessage({
        to,
        text: `🔔 This is a test message from LeadBridge!\n\nYour WhatsApp Cloud API is configured correctly.\n\nTimestamp: ${new Date().toISOString()}\n\n— LeadBridge`,
        recipientType: "customer",
      });

      if (result) {
        return reply.send({
          success: true,
          messageId: result,
          message: `✅ Test message sent to ${to}. Check your WhatsApp!`,
        });
      } else {
        return reply.status(500).send({
          error: "WhatsApp send failed",
          message: "Failed to send test message. Check the server logs for details.",
        });
      }
    } catch (err: any) {
      logger.error({ err: err.message, to }, "Admin WhatsApp test send failed");
      return reply.status(500).send({
        error: "WhatsApp send failed",
        message: err.message || "Failed to send test message",
      });
    }
  });

  // ─── POST /admin/whatsapp/test/webhook — Simulate Meta webhook verification ──
  fastify.post("/admin/whatsapp/test/webhook", async (_request: FastifyRequest, reply: FastifyReply) => {
    // Simulate what Meta sends for webhook verification
    const { verifyWebhook } = await import("../../services/whatsapp.service");
    const challenge = "test-challenge-123";
    const result = verifyWebhook("subscribe", config.WHATSAPP_VERIFY_TOKEN || "", challenge);

    if (result === challenge) {
      return reply.send({
        success: true,
        message: "✅ Webhook verification would succeed. Meta can verify your webhook endpoint.",
        verifyToken: config.WHATSAPP_VERIFY_TOKEN ? maskString(config.WHATSAPP_VERIFY_TOKEN) : "NOT SET",
      });
    } else {
      return reply.status(400).send({
        error: "Webhook verification would fail",
        message: "The WHATSAPP_VERIFY_TOKEN in your .env doesn't match what Meta would send. Check your configuration.",
      });
    }
  });
}

function maskString(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  return value.substring(0, 4) + "•".repeat(Math.min(value.length - 8, 12)) + value.substring(value.length - 4);
}

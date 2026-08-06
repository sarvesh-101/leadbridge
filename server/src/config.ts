import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().default("http://localhost:3001"),
  // Public base URL for inbound webhooks (e.g. ngrok https://xxxx.ngrok-free.app).
  // Used to build the Omnidimension call-events webhook URL that gets registered
  // on AI agents. When empty, the request's own protocol/hostname is used (which
  // is unreliable behind a proxy, so ALWAYS set this for real call cost tracking).
  WEBHOOK_URL: z.string().optional(),

  // Demo Mode — run without external APIs for investor demos
  DEMO_MODE: z.coerce.boolean().default(false),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  // Database
  DATABASE_URL: z.string(),
  DATABASE_URL_PRISMA: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // ─── Provider Selection ─────────────────────────────────
  PHONE_PROVIDER: z.enum(["twilio", "omnidimension"]).default("omnidimension"),
  VOICE_AI_PROVIDER: z.enum(["omnidimension"]).default("omnidimension"),

  // Omnidimension — AI Voice Agent Platform
  // Required ONLY when DEMO_MODE=false
  OMNIDIM_API_KEY: z.string().default(""),
  OMNIDIM_BASE_URL: z.string().default("https://backend.omnidim.io/api/v1"),

  // Default ElevenLabs voice ID for AI agents (Rachel)
  DEFAULT_ELEVENLABS_VOICE_ID: z.string().default("21m00Tcm4TlvDq8ikWAM"),

  // Twilio — Direct phone number purchasing (alternative to Omnidimension)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VOICE_URL: z.string().optional(),
  TWILIO_SMS_URL: z.string().optional(),


  // LLM Provider (OpenAI-compatible API — works with DeepSeek, OpenRouter, etc.)
  // Used for post-call transcript extraction, WhatsApp chatbot, and script generation.
  // OpenRouter key takes precedence when set (hosts DeepSeek/Qwen/Llama models with one key).
  // Default: deepseek-chat via DeepSeek's official API
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  OPENROUTER_API_KEY: z.string().optional(),

  // WhatsApp Cloud API — optional in demo mode
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_STARTER: z.string().optional(),
  RAZORPAY_PLAN_GROWTH: z.string().optional(),
  RAZORPAY_PLAN_PRO: z.string().optional(),

  // Supabase
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_RECORDINGS_BUCKET: z.string().default("call-recordings"),

  // Email (SMTP — works with AWS SES, SendGrid, Gmail, Mailgun, any SMTP provider)
  // Uses Nodemailer. Free tiers: AWS SES (62K/mo), Brevo (300/day), SMTP2GO (1K/mo)
  SMTP_HOST: z.string().default("email-smtp.ap-south-1.amazonaws.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  FROM_EMAIL: z.string().default("noreply@leadbridge.com"),
  FROM_NAME: z.string().default("LeadBridge"),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Cron
  CRON_SECRET: z.string().default("change-me-cron-secret"),

  // MessageBird (SMS fallback for WhatsApp)
  MESSAGEBIRD_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().default("LeadBrg"),

  // Encryption (for credential storage at rest)
  // Optional in development; defaults to JWT_SECRET-based derivation if not set
  ENCRYPTION_KEY: z.string().optional(),

  // Error reporting — optional Sentry DSN (https://<publicKey>@<host>/<projectId>)
  // When set, errors are reported to Sentry via the HTTP envelope API.
  SENTRY_DSN: z.string().optional(),

  // ─── Cost Tracking ───────────────────────────────────────
  // How much does the platform pay per minute for OmniDimension calls
  OMNIDIM_COST_PER_MINUTE: z.coerce.number().default(4.6),  // ₹4.6/min (Growth plan pricing)
  // Phone number monthly rental cost
  PHONE_NUMBER_MONTHLY_COST: z.coerce.number().default(200), // ₹200/month
  // Platform credit low balance warning threshold (percentage of minutes remaining)
  CREDIT_WARN_THRESHOLD_PERCENT: z.coerce.number().default(20),
  // Average duration per call for cost estimation
  AVG_CALL_DURATION_MINUTES: z.coerce.number().default(2),   // 2 minutes avg

  // Broker credit conversion: how many calls per rupee for offline payments
  BROKER_CALL_PRICE: z.coerce.number().default(70),  // ~₹70/call = ₹35K/500 calls (Growth plan)

  // FIX Round-2 #4: hard monthly call cap for PRO. PLAN_DEFINITIONS.PRO.calls is
  // 999999 ("unlimited"), but the platform pays per-minute while PRO is flat
  // ₹60K/mo — unbounded cost risk. 0 = no cap (dangerous); default 5000 keeps
  // margin safe (₹4.6/min × ~2min avg ≈ ₹9.2/call × 5000 ≈ ₹46K < ₹60K revenue).
  PRO_MONTHLY_CALL_CAP: z.coerce.number().default(5000),

  // ─── SMS & Email Forwarding ─────────────────────────────
  // The Twilio number that brokers forward portal SMS to
  FORWARDING_SMS_NUMBER: z.string().optional(),
  // The email address that brokers forward portal emails to
  FORWARDING_EMAIL: z.string().optional(),

});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;

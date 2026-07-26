import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().default("http://localhost:3001"),

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


  // LLM Provider (OpenAI-compatible API — works with OpenRouter, DeepSeek, etc.)
  // Used for post-call transcript extraction, WhatsApp chatbot, and script generation.
  // Default: Qwen3 Next 80B A3B Instruct via OpenRouter (free, fast, multilingual)
  DEEPSEEK_API_KEY: z.string().optional(),
  DEEPSEEK_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  DEEPSEEK_MODEL: z.string().default("qwen/qwen3-next-80b-a3b-instruct:free"),

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
  BROKER_CALL_PRICE: z.coerce.number().default(116),  // ~₹116/call = ₹35K/300 calls

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

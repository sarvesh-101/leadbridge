import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import formbodyPlugin from "@fastify/formbody";
import bcrypt from "bcryptjs";
import { config } from "./config";
import { logger } from "./utils/logger";

// ─── Request ID generation ────────────────────────────────────
function generateRequestId(): string {
  return crypto.randomUUID();
}

// Plugin imports
import prismaPlugin from "./plugins/prisma";
import redisPlugin from "./plugins/redis";
import authPlugin from "./plugins/auth";
import rateLimitPlugin from "./plugins/rateLimit";
import websocketPlugin from "./plugins/websocket";

// Route imports
import authRoutes from "./routes/auth";
import adminDashboardRoutes from "./routes/admin/dashboard";
import adminClientRoutes from "./routes/admin/clients";
import adminAnalyticsRoutes from "./routes/admin/analytics";
import adminTerritoryRoutes from "./routes/admin/territories";
import clientLeadRoutes from "./routes/client/leads";
import clientCallRoutes from "./routes/client/calls";
import clientBookingRoutes from "./routes/client/bookings";
import clientDashboardRoutes from "./routes/client/dashboard";
import clientSettingsRoutes from "./routes/client/settings";
import clientBillingRoutes from "./routes/client/billing";
import clientCampaignRoutes from "./routes/client/campaigns";
import clientIntegrationRoutes from "./routes/client/integrations";
import clientTerritoryRoutes from "./routes/client/territories";
import clientVoiceRoutes from "./routes/client/voice";
import clientMessagesRoutes from "./routes/client/messages";
import clientPropertyRoutes from "./routes/client/properties";
import csvImportRoutes from "./routes/client/csv-import";
import teamRoutes from "./routes/client/team";
import documentRoutes from "./routes/client/documents";
import paymentLinkRoutes from "./routes/client/payment-links";
import transcriptSearchRoutes from "./routes/client/transcript-search";
import notificationPreferenceRoutes from "./routes/client/notification-preferences";
import reportBuilderRoutes from "./routes/client/report-builder";
import sheetsSyncRoutes from "./routes/client/sheets-sync";
import roiAnalyticsRoutes from "./routes/client/roi-analytics";
import notificationRoutes from "./routes/client/notifications";
import emailCampaignRoutes from "./routes/client/email-campaigns";
import smsCampaignRoutes from "./routes/client/sms-campaigns";
import templateRoutes from "./routes/client/templates";
import abTestingRoutes from "./routes/client/ab-testing";
import propertySuggestionRoutes from "./routes/client/property-suggestions";
import referralRoutes from "./routes/client/referrals";
import apiKeyRoutes from "./routes/client/api-keys";
import calendarSyncRoutes from "./routes/client/calendar-sync";
import customerActivityRoutes from "./routes/client/customer-activity";
import territoryComparisonRoutes from "./routes/admin/territory-comparison";
import ingestWebhookRoutes from "./routes/webhooks/ingest";
import smsForwardingRoutes from "./routes/webhooks/sms-forwarding";
import emailForwardingRoutes from "./routes/webhooks/email-forwarding";
import forwardingTestRoutes from "./routes/webhooks/forwarding-test";

import omnidimensionWebhookRoutes from "./routes/webhooks/omnidimension";
import razorpayWebhookRoutes from "./routes/webhooks/razorpay";
import whatsappWebhookRoutes from "./routes/webhooks/whatsapp";
import webhookSourcesRoutes from "./routes/webhooks/sources";
import adminAuditLogRoutes from "./routes/admin/audit-logs";
import adminQueueRoutes from "./routes/admin/queues";
import adminWebhookRoutes from "./routes/admin/webhooks";
import customerRoutes from "./routes/customer";
import metricsRoutes from "./routes/metrics";
import demoRoutes from "./routes/demo";
// ─── Cron Jobs ────────────────────────────────────────────────
import { registerCronJobs } from "./cron/scheduler";

// ─── Queue utilities ───────────────────────────────────────────
import { isRedisAvailable } from "./workers/queues";

// ─── BullMQ Workers ────────────────────────────────────────────
// Import workers so they start processing their queues immediately.
// Named imports are used so gracefulShutdown can close() them directly.
// DO NOT import the campaign worker here — it runs as a separate Docker container.
import callWorker from "./workers/call.worker";
import notificationWorker from "./workers/notification.worker";
import extractionWorker from "./workers/extraction.worker";
import followupWorker from "./workers/followup.worker";
import reminderWorker from "./workers/reminder.worker";
import webhookRetryWorker from "./workers/webhook-retry.worker";

import { getCircuitState } from "./utils/circuit-breaker";
import { disconnectPrisma } from "./utils/prisma-shared";
import trackingRoutes from "./routes/tracking";
import adminCreditRoutes from "./routes/admin/credits";
import adminRevenueRoutes from "./routes/admin/revenue-recognition";
import adminPaymentRoutes from "./routes/admin/payments";
import adminWhatsAppRoutes from "./routes/admin/whatsapp-config";

// Module-level server reference for graceful shutdown
let __server: Awaited<ReturnType<typeof buildServer>> | null = null;

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      transport: config.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // ─── Request ID Middleware ──────────────────────────────
  server.addHook("onRequest", async (request, reply) => {
    const requestId = generateRequestId();
    reply.header("X-Request-Id", requestId);
    // Add request ID to request for tracing
    (request as unknown as Record<string, unknown>).requestId = requestId;
  });

  // ─── Register Plugins ──────────────────────────────────────
  await server.register(cors, {
    origin: config.FRONTEND_URL
      ? config.FRONTEND_URL.split(",").map((s) => s.trim())
      : ["http://localhost:3001"],
    credentials: true,
  });

  await server.register(websocket);
  await server.register(formbodyPlugin);
  await server.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max
  await server.register(rateLimitPlugin);
  await server.register(prismaPlugin);
  await server.register(redisPlugin);
  await server.register(authPlugin);
  await server.register(websocketPlugin);

  // ─── Health & Metrics (outside API prefix) ─────────────────
  server.get("/health", async () => {
    // Check database health with a simple SELECT 1
    let dbHealthy = false;
    try {
      await server.prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }

    // Check Redis health (from websocket plugin)
    const wsRedisHealthy = (server as unknown as Record<string, unknown>).wsRedisHealthy !== false;

    // Check queue health (from queues.ts)
    const queuesHealthy = isRedisAvailable();

    // Check WhatsApp config
    const whatsappConfigured = !!(config.WHATSAPP_TOKEN) && !!(config.WHATSAPP_PHONE_ID);

    // Check Voice AI config
    const voiceAIConfigured = !!(config.OMNIDIM_API_KEY);

    // Check MessageBird config (SMS fallback)
    const smsConfigured = !!(config.MESSAGEBIRD_API_KEY);

    const checks = {
      database: dbHealthy ? ("healthy" as const) : ("unhealthy" as const),
      redis: wsRedisHealthy ? ("healthy" as const) : ("degraded" as const),
      queues: queuesHealthy ? ("healthy" as const) : ("unhealthy" as const),
      websocket: {
        connectedClients: (server as unknown as Record<string, unknown>).getConnectedClients || 0,
      },
      integrations: {
        whatsapp: whatsappConfigured ? ("configured" as const) : ("not-configured" as const),
        voice_ai: voiceAIConfigured ? ("configured" as const) : ("not-configured" as const),
        sms_fallback: smsConfigured ? ("configured" as const) : ("not-configured" as const),
      },
    };

    // CRITICAL: If Redis is unavailable, the system will accept leads but NEVER call them.
    // The health status MUST reflect this accurately so operators know.
    const redisDegraded = !wsRedisHealthy || !queuesHealthy;

    const overallStatus = redisDegraded
      ? "degraded"
      : Object.values(checks).every((c) =>
          typeof c === "string" ? c === "healthy" : true
        )
        ? "healthy"
        : "degraded";

    return {
      status: overallStatus,
      app: "LeadBridge",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      checks,
      warnings: redisDegraded
        ? [
            "⚠️ REDIS IS UNAVAILABLE — Leads will be ingested but NEVER called. Follow-ups, reminders, and notifications will NOT run.",
            "   Start Redis with: docker run -p 6379:6379 redis:alpine",
          ]
        : [],
    };
  });

  // ─── Detailed Integration Health ─────────────────────────
  server.get("/health/integrations", async () => {
    const circuitState = getCircuitState("omnidimension");

    const integrations = {
      whatsapp: {
        configured: !!(config.WHATSAPP_TOKEN) && !!(config.WHATSAPP_PHONE_ID),
        missingVars: buildMissingList([
          ["WHATSAPP_TOKEN", config.WHATSAPP_TOKEN],
          ["WHATSAPP_PHONE_ID", config.WHATSAPP_PHONE_ID],
          ["WHATSAPP_VERIFY_TOKEN", config.WHATSAPP_VERIFY_TOKEN],
        ]),
      },
      sms: {
        configured: !!(config.MESSAGEBIRD_API_KEY),
        type: "MessageBird (WhatsApp fallback)",
        missingVars: buildMissingList([
          ["MESSAGEBIRD_API_KEY", config.MESSAGEBIRD_API_KEY],
        ]),
      },
      email: {
        configured: !!(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS),
        type: "Nodemailer (SMTP)",
        missingVars: buildMissingList([
          ["SMTP_HOST", config.SMTP_HOST],
          ["SMTP_USER", config.SMTP_USER],
          ["SMTP_PASS", config.SMTP_PASS],
        ]),
      },
      voice_ai: {
        configured: !!(config.OMNIDIM_API_KEY),
        provider: config.VOICE_AI_PROVIDER,
        circuitState: circuitState.state,
        circuitFailureCount: circuitState.failureCount,
        circuitCooldownRemainingMs: circuitState.cooldownRemainingMs,
        missingVars: buildMissingList([
          ["OMNIDIM_API_KEY", config.OMNIDIM_API_KEY],
        ]),
      },
      phone: {
        configured: config.PHONE_PROVIDER === "twilio"
          ? !!(config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN)
          : !!(config.OMNIDIM_API_KEY),
        provider: config.PHONE_PROVIDER,
        missingVars: buildMissingList(([
          ["PHONE_PROVIDER", config.PHONE_PROVIDER],
          ...(config.PHONE_PROVIDER === "twilio"
            ? [["TWILIO_ACCOUNT_SID", config.TWILIO_ACCOUNT_SID], ["TWILIO_AUTH_TOKEN", config.TWILIO_AUTH_TOKEN]]
            : [["OMNIDIM_API_KEY", config.OMNIDIM_API_KEY]]
          ),
        ] as Array<[string, string | undefined | null]>)),
      },
      platform_credits: {
        configured: true,
        costPerMinute: config.OMNIDIM_COST_PER_MINUTE,
        avgCallDurationMinutes: config.AVG_CALL_DURATION_MINUTES,
        warningThresholdPercent: config.CREDIT_WARN_THRESHOLD_PERCENT,
      },

      razorpay: {
        configured: !!(
          config.RAZORPAY_KEY_ID &&
        config.RAZORPAY_KEY_SECRET &&
          config.RAZORPAY_PLAN_STARTER
        ),
        missingVars: buildMissingList([
          ["RAZORPAY_KEY_ID", config.RAZORPAY_KEY_ID],
          ["RAZORPAY_KEY_SECRET", config.RAZORPAY_KEY_SECRET],
          ["RAZORPAY_PLAN_STARTER", config.RAZORPAY_PLAN_STARTER],
          ["RAZORPAY_PLAN_GROWTH", config.RAZORPAY_PLAN_GROWTH],
          ["RAZORPAY_PLAN_PRO", config.RAZORPAY_PLAN_PRO],
        ]),
      },
      sms_forwarding: {
        configured: !!(config.FORWARDING_SMS_NUMBER),
        forwardingNumber: config.FORWARDING_SMS_NUMBER || null,
        setupGuide: "https://console.twilio.com → Phone Numbers → Active Numbers → Configure SMS webhook",
        missingVars: buildMissingList([
          ["FORWARDING_SMS_NUMBER", config.FORWARDING_SMS_NUMBER],
        ]),
      },
      email_forwarding: {
        configured: false,
        forwardingEmail: config.FORWARDING_EMAIL || null,
        setupGuide: "Set up SendGrid Inbound Parse or Mailgun Routes → POST to /api/v1/webhooks/email/incoming",
        missingVars: buildMissingList([
          ["FORWARDING_EMAIL", config.FORWARDING_EMAIL],
        ]),
      },
      redis: {
        available: isRedisAvailable(),
      },
    };

    // Try to attach live credit data (non-blocking — graceful failure)
    try {
      const { checkCreditHealth } = await import("./services/credit-manager.service");
      const creditHealth = await checkCreditHealth(server.prisma);
      (integrations as any).platform_credits = {
        ...(integrations as any).platform_credits,
        minutesPurchased: creditHealth.minutesPurchased,
        minutesUsed: creditHealth.minutesUsed,
        minutesRemaining: creditHealth.minutesRemaining,
        remainingPercent: creditHealth.remainingPercent,
        totalCost: creditHealth.totalCost,
        effectiveCostPerMinute: creditHealth.effectiveCostPerMinute,
        needsTopUp: creditHealth.needsAlert,
      };
    } catch {
      // Graceful fallback — credit tracking not yet initialized
    }

    const unconfigured = (Object.entries(integrations) as [string, Record<string, unknown>][])
      .filter(([, v]) => v.configured === false && "missingVars" in v)
      .map(([name]) => name);

    return {
      status: unconfigured.length === 0 ? "all-configured" : "missing-configuration",
      unconfigured,
      integrations,
    };
  });

  function buildMissingList(vars: Array<[string, string | undefined | null]>): string[] {
    return vars.filter(([, val]) => !val).map(([name]) => name);
  }

  // Prometheus metrics (registered at root level for Prometheus scrape)
  await server.register(metricsRoutes);

  // ─── Register Routes (all prefixed with /api/v1) ──────────
  const apiPrefix = "/api/v1";

  // Auth (public)
  await server.register(authRoutes, { prefix: apiPrefix });

  // Admin routes
  await server.register(adminDashboardRoutes, { prefix: apiPrefix });
  await server.register(adminClientRoutes, { prefix: apiPrefix });
  await server.register(adminAnalyticsRoutes, { prefix: apiPrefix });
  await server.register(adminTerritoryRoutes, { prefix: apiPrefix });
  await server.register(adminAuditLogRoutes, { prefix: apiPrefix });
  await server.register(adminQueueRoutes, { prefix: apiPrefix });
  await server.register(adminWebhookRoutes, { prefix: apiPrefix });
  await server.register(adminCreditRoutes, { prefix: apiPrefix });
  await server.register(adminRevenueRoutes, { prefix: apiPrefix });
  await server.register(adminPaymentRoutes, { prefix: apiPrefix });
  await server.register(adminWhatsAppRoutes, { prefix: apiPrefix });


  // Client routes
  await server.register(clientLeadRoutes, { prefix: apiPrefix });
  await server.register(clientCallRoutes, { prefix: apiPrefix });
  await server.register(clientBookingRoutes, { prefix: apiPrefix });
  await server.register(clientDashboardRoutes, { prefix: apiPrefix });
  await server.register(clientSettingsRoutes, { prefix: apiPrefix });
  await server.register(clientBillingRoutes, { prefix: apiPrefix });
  await server.register(clientCampaignRoutes, { prefix: apiPrefix });
  await server.register(clientIntegrationRoutes, { prefix: apiPrefix });
  await server.register(clientTerritoryRoutes, { prefix: apiPrefix });
  await server.register(clientVoiceRoutes, { prefix: apiPrefix });
  await server.register(clientMessagesRoutes, { prefix: apiPrefix });
  await server.register(clientPropertyRoutes, { prefix: apiPrefix });
  await server.register(csvImportRoutes, { prefix: apiPrefix });
  await server.register(teamRoutes, { prefix: apiPrefix });
  await server.register(documentRoutes, { prefix: apiPrefix });
  await server.register(paymentLinkRoutes, { prefix: apiPrefix });
  await server.register(transcriptSearchRoutes, { prefix: apiPrefix });
  await server.register(notificationPreferenceRoutes, { prefix: apiPrefix });
  await server.register(reportBuilderRoutes, { prefix: apiPrefix });
  await server.register(sheetsSyncRoutes, { prefix: apiPrefix });
  await server.register(roiAnalyticsRoutes, { prefix: apiPrefix });
  await server.register(emailCampaignRoutes, { prefix: apiPrefix });
  await server.register(abTestingRoutes, { prefix: apiPrefix });
  await server.register(smsCampaignRoutes, { prefix: apiPrefix });
  await server.register(templateRoutes, { prefix: apiPrefix });
  await server.register(notificationRoutes, { prefix: apiPrefix });
  await server.register(calendarSyncRoutes, { prefix: apiPrefix });
  await server.register(customerActivityRoutes, { prefix: apiPrefix });
  await server.register(territoryComparisonRoutes, { prefix: apiPrefix });
  await server.register(propertySuggestionRoutes, { prefix: apiPrefix });
  await server.register(apiKeyRoutes, { prefix: apiPrefix });
  await server.register(referralRoutes, { prefix: apiPrefix });
  await server.register(webhookSourcesRoutes, { prefix: apiPrefix });

  // Demo mode routes (only when DEMO_MODE=true)
  if (config.DEMO_MODE) {
    await server.register(demoRoutes, { prefix: apiPrefix });
    logger.info("🎯 DEMO MODE enabled — all external APIs simulated");
  }

  // Customer portal routes (auth via OTP)
  await server.register(customerRoutes, { prefix: apiPrefix });

  // Tracking routes (no auth — used by email tracking pixel and redirects)
  await server.register(trackingRoutes, { prefix: apiPrefix });

  // Webhooks (no auth — token or signature based)
  await server.register(ingestWebhookRoutes, { prefix: apiPrefix });
  await server.register(omnidimensionWebhookRoutes, { prefix: apiPrefix });
  await server.register(razorpayWebhookRoutes, { prefix: apiPrefix });
  await server.register(whatsappWebhookRoutes, { prefix: apiPrefix });
  await server.register(smsForwardingRoutes, { prefix: apiPrefix });
  await server.register(emailForwardingRoutes, { prefix: apiPrefix });
  await server.register(forwardingTestRoutes, { prefix: apiPrefix });

  // ─── Invoice PDF Serving ─────────────────────────────────────
  // FIX #2: Serve generated GST invoice PDFs
  server.get("/invoices/:filename", async (request, reply) => {
    const { filename } = request.params as { filename: string };
    // Basic security: only allow PDF files and prevent path traversal
    if (!filename.endsWith(".pdf") || filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const path = await import("path");
    const fs = await import("fs");
    const filePath = path.join(process.cwd(), "invoices", filename);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: "Invoice not found" });
    }

    const stream = fs.createReadStream(filePath);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `inline; filename="${filename}"`);
    return reply.send(stream);
  });

  // ─── Error Handler ─────────────────────────────────────────
  server.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error.message, stack: error.stack }, "Unhandled error");

    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: "Too many requests",
        message: error.message,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: "Validation error",
        message: error.message,
        details: error.validation,
      });
    }

    return reply.status(error.statusCode || 500).send({
      error: "Internal server error",
      message: config.NODE_ENV === "production" ? "Something went wrong" : error.message,
    });
  });

  // Store server reference for graceful shutdown
  __server = server;

  return server;
}

// ─── Auto-create first admin on first run ───────────────────────
async function ensureAdmin() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const adminCount = await prisma.admin.count();
  if (adminCount === 0) {
    const email = "admin@leadbridge.com";
    const tempPassword = crypto.randomUUID().split("-").pop() + "A1!";
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.admin.create({
      data: { email, name: "Platform Admin", passwordHash },
    });

    logger.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.warn("🚀 FIRST-RUN: No admin existed — created one.");
    logger.warn("");
    logger.warn(`   Email:    ${email}`);
    logger.warn(`   Password: ${tempPassword}`);
    logger.warn("");
    logger.warn("⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN");
    logger.warn("   Use: Admin tab > Login with email above");
    logger.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  await prisma.$disconnect();
}

// ─── Pre-flight Startup Validation ─────────────────────────────
async function validateEnvironment(): Promise<void> {
  const required = [
    { key: "JWT_SECRET", value: config.JWT_SECRET, hint: "Generate with: openssl rand -hex 32" },
    { key: "JWT_REFRESH_SECRET", value: config.JWT_REFRESH_SECRET, hint: "Generate with: openssl rand -hex 32" },
    ...(config.DEMO_MODE ? [] : [{ key: "OMNIDIM_API_KEY", value: config.OMNIDIM_API_KEY, hint: "Get from Omnidimension dashboard. Set DEMO_MODE=true to skip." }]),
  ];

  for (const { key, value, hint } of required) {
    if (!value || value === "change-me") {
      logger.error(`❌ Missing required env var: ${key}`);
      logger.error(`   ${hint}`);
      process.exit(1);
    }
  }

  if (config.DEMO_MODE) {
    logger.warn("");
    logger.warn("╔═══════════════════════════════════════════════════════════╗");
    logger.warn("║  🎯  DEMO MODE ACTIVE                                   ║");
    logger.warn("║                                                         ║");
    logger.warn("║  All external APIs are being SIMULATED.                 ║");
    logger.warn("║  No real calls, WhatsApp, SMS, or emails will be sent.  ║");
    logger.warn("║                                                         ║");
    logger.warn("║  Login: demo@broker.com / demo123!A                     ║");
    logger.warn("║                                                         ║");
    logger.warn("║  Demo API: POST /api/v1/demo/seed-data                  ║");
    logger.warn("║                                                         ║");
    logger.warn("║  Set DEMO_MODE=false in .env to use real APIs.          ║");
    logger.warn("╚═══════════════════════════════════════════════════════════╝");
    logger.warn("");
  }

  // Validate phone provider-specific vars
  if (config.PHONE_PROVIDER === "twilio" && !config.TWILIO_ACCOUNT_SID) {
    logger.warn("⚠️  PHONE_PROVIDER=twilio but TWILIO_ACCOUNT_SID not set. Phone number features will be unavailable.");
  }

  logger.info("✅ Environment validation passed");

  // Warn if Redis is not available — this is CRITICAL for core automation
  if (!isRedisAvailable()) {
    logger.warn("");
    logger.warn("╔═══════════════════════════════════════════════════════════╗");
    logger.warn("║  ⚠️  REDIS IS NOT AVAILABLE                             ║");
    logger.warn("║                                                         ║");
    logger.warn("║  The server will START, but the core automation WILL    ║");
    logger.warn("║  NOT WORK. Leads will be ingested but NEVER called.     ║");
    logger.warn("║                                                         ║");
    logger.warn("║  - No AI calls will be dispatched                       ║");
    logger.warn("║  - No follow-ups or reminders                           ║");
    logger.warn("║  - No notifications via WhatsApp/SMS                    ║");
    logger.warn("║  - No post-call extraction                              ║");
    logger.warn("║                                                         ║");
    logger.warn("║  Start Redis: docker run -p 6379:6379 redis:alpine       ║");
    logger.warn("╚═══════════════════════════════════════════════════════════╝");
    logger.warn("");
  }
}

// ─── Start Server ───────────────────────────────────────────────
async function start() {
  try {
    // Pre-flight validation
    await validateEnvironment();

    await ensureAdmin();

    const server = await buildServer();

    // Register cron jobs (non-blocking — runs alongside the server)
    registerCronJobs();

    // BullMQ workers are already started via imports above.
    // The campaign worker runs as a separate Docker container (see docker-compose.yml)
    // DO NOT start it here — it would create duplicate processing.
    logger.info("✅ BullMQ workers started: call, notification, extraction, followup, reminder, webhook-retry");

    await server.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info(`LeadBridge server running on port ${config.PORT}`);
    logger.info(`Health check: http://localhost:${config.PORT}/health`);
    logger.info(`API: http://localhost:${config.PORT}/api/v1`);
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

start();

// ─── Graceful Shutdown ──────────────────────────────────────────
let shuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  try {
    // Close the Fastify server (stops accepting new requests)
    if (__server) {
      await __server.close();
      logger.info("HTTP server closed");
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Error closing HTTP server");
  }

  try {
    // Close BullMQ workers (each gracefully waits for active jobs to finish)
    await Promise.allSettled([
      callWorker.close(),
      notificationWorker.close(),
      extractionWorker.close(),
      followupWorker.close(),
      reminderWorker.close(),
      webhookRetryWorker.close(),
    ]);
    logger.info("All BullMQ workers closed");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Error closing BullMQ workers");
  }

  try {
    // Disconnect shared Prisma singleton (waits for pending queries)
    await disconnectPrisma();
    logger.info("Prisma disconnected");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Error disconnecting Prisma");
  }

  try {
    // Close Redis connections
    const IORedis = (await import("ioredis")).default;
    const redis = new IORedis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
    await redis.quit();
    logger.info("Redis connections drained");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Error draining Redis");
  }

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Unhandled Error Handlers ──────────────────────────────────
process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
  logger.error(
    { err: reason instanceof Error ? reason.message : String(reason), stack: reason instanceof Error ? reason.stack : undefined },
    "UNHANDLED PROMISE REJECTION — process continuing"
  );
});

process.on("uncaughtException", (error: Error) => {
  logger.error(
    { err: error.message, stack: error.stack },
    "UNCAUGHT EXCEPTION — process will exit"
  );
  // Give logger time to flush, then exit
  setTimeout(() => process.exit(1), 1000);
});

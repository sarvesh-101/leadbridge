import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import bcrypt from "bcryptjs";
import { config } from "./config";
import { logger } from "./utils/logger";

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
import ingestWebhookRoutes from "./routes/webhooks/ingest";
import exotelWebhookRoutes from "./routes/webhooks/exotel";
import omnidimensionWebhookRoutes from "./routes/webhooks/omnidimension";
import razorpayWebhookRoutes from "./routes/webhooks/razorpay";
import whatsappWebhookRoutes from "./routes/webhooks/whatsapp";
import webhookSourcesRoutes from "./routes/webhooks/sources";
import adminAuditLogRoutes from "./routes/admin/audit-logs";
import adminQueueRoutes from "./routes/admin/queues";
import adminWebhookRoutes from "./routes/admin/webhooks";
import metricsRoutes from "./routes/metrics";
import { registerCronJobs } from "./cron/scheduler";
import { isRedisAvailable } from "./workers/queues";

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
      transport: config.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // ─── Register Plugins ──────────────────────────────────────
  await server.register(cors, {
    origin: config.FRONTEND_URL
      ? config.FRONTEND_URL.split(",").map((s) => s.trim())
      : ["http://localhost:3001"],
    credentials: true,
  });

  await server.register(websocket);
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
    const wsRedisHealthy = (server as any).wsRedisHealthy !== false;

    // Check queue health (from queues.ts)
    const queuesHealthy = isRedisAvailable();

    // Check WhatsApp config
    const whatsappConfigured = !!(config.WHATSAPP_TOKEN) && !!(config.WHATSAPP_PHONE_ID);

    // Check Omnidimension config
    const omnidimensionConfigured = !!(config.OMNIDIM_API_KEY);

    // Check MessageBird config (SMS fallback)
    const smsConfigured = !!(config.MESSAGEBIRD_API_KEY);

    const checks = {
      database: dbHealthy ? ("healthy" as const) : ("unhealthy" as const),
      redis: wsRedisHealthy ? ("healthy" as const) : ("degraded" as const),
      queues: queuesHealthy ? ("healthy" as const) : ("unhealthy" as const),
      websocket: {
        connectedClients: (server as any).getConnectedClients || 0,
      },
      integrations: {
        whatsapp: whatsappConfigured ? ("configured" as const) : ("not-configured" as const),
        omnidimension: omnidimensionConfigured ? ("configured" as const) : ("not-configured" as const),
        sms_fallback: smsConfigured ? ("configured" as const) : ("not-configured" as const),
      },
    };

    const overallStatus = Object.values(checks).every((c) =>
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
    };
  });

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
  await server.register(webhookSourcesRoutes, { prefix: apiPrefix });

  // Webhooks (no auth — token or signature based)
  await server.register(ingestWebhookRoutes, { prefix: apiPrefix });
  await server.register(exotelWebhookRoutes, { prefix: apiPrefix });
  await server.register(omnidimensionWebhookRoutes, { prefix: apiPrefix });
  await server.register(razorpayWebhookRoutes, { prefix: apiPrefix });
  await server.register(whatsappWebhookRoutes, { prefix: apiPrefix });

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
  (global as any).__server = server;

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
    { key: "OMNIDIM_API_KEY", value: config.OMNIDIM_API_KEY, hint: "Get from Omnidimension dashboard" },
  ];

  for (const { key, value, hint } of required) {
    if (!value || value === "change-me") {
      logger.error(`❌ Missing required env var: ${key}`);
      logger.error(`   ${hint}`);
      process.exit(1);
    }
  }

  logger.info("✅ Environment validation passed");
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
    if ((global as any).__server) {
      await (global as any).__server.close();
      logger.info("HTTP server closed");
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Error closing HTTP server");
  }

  try {
    // Disconnect Prisma (waits for pending queries)
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$disconnect();
    logger.info("Prisma disconnected");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Error disconnecting Prisma");
  }

  try {
    // Close Redis connections
    const IORedis = (await import("ioredis")).default;
    // Create a temp connection just to explicitly quit
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

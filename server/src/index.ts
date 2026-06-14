import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
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
import clientLeadRoutes from "./routes/client/leads";
import clientCallRoutes from "./routes/client/calls";
import clientBookingRoutes from "./routes/client/bookings";
import clientDashboardRoutes from "./routes/client/dashboard";
import clientSettingsRoutes from "./routes/client/settings";
import clientBillingRoutes from "./routes/client/billing";
import ingestWebhookRoutes from "./routes/webhooks/ingest";
import exotelWebhookRoutes from "./routes/webhooks/exotel";
import razorpayWebhookRoutes from "./routes/webhooks/razorpay";
import whatsappWebhookRoutes from "./routes/webhooks/whatsapp";

export async function buildServer() {
  const server = Fastify({
    logger: false, // Using pino directly
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
  await server.register(rateLimitPlugin);
  await server.register(prismaPlugin);
  await server.register(redisPlugin);
  await server.register(authPlugin);
  await server.register(websocketPlugin);

  // ─── Health Check ──────────────────────────────────────────
  server.get("/health", async () => ({
    status: "healthy",
    app: "LeadBridge",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  }));

  // ─── Register Routes (all prefixed with /api/v1) ──────────
  const apiPrefix = "/api/v1";

  // Auth (public)
  await server.register(authRoutes, { prefix: apiPrefix });

  // Admin routes
  await server.register(adminDashboardRoutes, { prefix: apiPrefix });
  await server.register(adminClientRoutes, { prefix: apiPrefix });

  // Client routes
  await server.register(clientLeadRoutes, { prefix: apiPrefix });
  await server.register(clientCallRoutes, { prefix: apiPrefix });
  await server.register(clientBookingRoutes, { prefix: apiPrefix });
  await server.register(clientDashboardRoutes, { prefix: apiPrefix });
  await server.register(clientSettingsRoutes, { prefix: apiPrefix });
  await server.register(clientBillingRoutes, { prefix: apiPrefix });

  // Webhooks (no auth — token or signature based)
  await server.register(ingestWebhookRoutes, { prefix: apiPrefix });
  await server.register(exotelWebhookRoutes, { prefix: apiPrefix });
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

// ─── Start Server ───────────────────────────────────────────────
async function start() {
  try {
    await ensureAdmin();

    const server = await buildServer();

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
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received — shutting down");
  process.exit(0);
});

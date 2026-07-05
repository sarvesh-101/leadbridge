/**
 * API Key Management Routes.
 *
 * These routes require broker JWT authentication (not API key auth).
 * Brokers can create, list, and revoke API keys for external integrations.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const API_KEY_PREFIX = "lb_";
const SALT_ROUNDS = 10;

export default async function apiKeyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── List API Keys ───────────────────────────────────────────
  fastify.get("/api-keys", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const keys = await fastify.prisma.apiKey.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerMinute: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        revokedReason: true,
        createdAt: true,
      },
    });

    return { keys };
  });

  // ─── Create API Key ─────────────────────────────────────────
  fastify.post("/api-keys", {
    schema: {
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 100 },
          scopes: { type: "array", items: { type: "string" } },
          rateLimitPerMinute: { type: "integer", minimum: 1, maximum: 1000, default: 60 },
          expiresInDays: { type: "integer", minimum: 1, maximum: 3650 },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: {
      name: string;
      scopes?: string[];
      rateLimitPerMinute?: number;
      expiresInDays?: number;
    };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { name, scopes, rateLimitPerMinute, expiresInDays } = request.body;

    // Default scopes: read-only access to leads and properties
    const finalScopes = scopes && scopes.length > 0
      ? scopes
      : ["leads:read", "properties:read"];

    // Validate scopes against allowed list
    const allowedScopes = [
      "leads:read", "leads:write",
      "properties:read", "properties:write",
      "bookings:read", "bookings:write",
      "calls:read",
      "analytics:read",
      "admin:all",
    ];

    const invalidScopes = finalScopes.filter((s) => !allowedScopes.includes(s));
    if (invalidScopes.length > 0) {
      return reply.status(400).send({
        error: `Invalid scopes: ${invalidScopes.join(", ")}. Allowed: ${allowedScopes.join(", ")}`,
      });
    }

    // Generate the key: lb_<random>
    const rawKey = `${API_KEY_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
    const keyPrefix = rawKey.substring(0, 12) + "...";
    const keyHash = await bcrypt.hash(rawKey, SALT_ROUNDS);

    const key = await fastify.prisma.apiKey.create({
      data: {
        clientId,
        name,
        keyPrefix,
        keyHash,
        scopes: finalScopes,
        rateLimitPerMinute: rateLimitPerMinute || 60,
        expiresAt: expiresInDays
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
      },
    });

    // Log the audit
    await fastify.prisma.auditLog.create({
      data: {
        clientId,
        action: "api_key.created",
        resourceType: "api_key",
        resourceId: key.id,
        changes: { name, scopes: finalScopes },
      },
    });

    // Return the full raw key ONCE at creation
    return reply.status(201).send({
      key: {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scopes: key.scopes,
        rateLimitPerMinute: key.rateLimitPerMinute,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
      rawKey, // ⚠️ Only shown once!
    });
  });

  // ─── Revoke API Key ─────────────────────────────────────────
  fastify.patch("/api-keys/:id/revoke", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { reason?: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const key = await fastify.prisma.apiKey.findFirst({
      where: { id: request.params.id, clientId },
    });

    if (!key) {
      return reply.status(404).send({ error: "API key not found" });
    }

    await fastify.prisma.apiKey.update({
      where: { id: key.id },
      data: {
        revokedAt: new Date(),
        revokedReason: request.body.reason || "Revoked by owner",
      },
    });

    await fastify.prisma.auditLog.create({
      data: {
        clientId,
        action: "api_key.revoked",
        resourceType: "api_key",
        resourceId: key.id,
        changes: { reason: request.body.reason },
      },
    });

    return { success: true };
  });

  // ─── Update API Key (name, scopes, rate limit) ─────────────
  fastify.patch("/api-keys/:id", async (request: FastifyRequest<{
    Params: { id: string };
    Body: { name?: string; scopes?: string[]; rateLimitPerMinute?: number };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const key = await fastify.prisma.apiKey.findFirst({
      where: { id: request.params.id, clientId, revokedAt: null },
    });

    if (!key) {
      return reply.status(404).send({ error: "API key not found or revoked" });
    }

    const updateData: Record<string, unknown> = {};
    if (request.body.name) updateData.name = request.body.name;
    if (request.body.scopes) updateData.scopes = request.body.scopes;
    if (request.body.rateLimitPerMinute) updateData.rateLimitPerMinute = request.body.rateLimitPerMinute;

    const updated = await fastify.prisma.apiKey.update({
      where: { id: key.id },
      data: updateData,
    });

    return { key: updated };
  });
}

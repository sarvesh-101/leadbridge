/**
 * Public API Key Authentication Plugin.
 *
 * Authenticates requests using Bearer API keys (format: `lb_<random>`).
 * Validates against the ApiKey model via bcrypt hash comparison.
 * Adds clientId and scopes to the request for downstream handlers.
 */
import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import bcrypt from "bcryptjs";

declare module "fastify" {
  interface FastifyRequest {
    apiKeyAuth?: {
      clientId: string;
      keyId: string;
      scopes: string[];
    };
  }
}

const API_KEY_PREFIX = "lb_";

/**
 * Verify an API key against the database.
 * Uses bcrypt compare to check the hash.
 */
async function verifyApiKey(
  prisma: any,
  rawKey: string
): Promise<{ clientId: string; keyId: string; scopes: string[] } | null> {
  // Ensure key has the right prefix
  if (!rawKey.startsWith(API_KEY_PREFIX)) return null;

  // Get all non-revoked, non-expired keys (we need to compare hash via bcrypt)
  // Since bcrypt doesn't support lookup by hash, we iterate over active keys
  // In production with many keys, consider a different approach
  const keys = await prisma.apiKey.findMany({
    where: {
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: {
      id: true,
      clientId: true,
      keyHash: true,
      scopes: true,
    },
  });

  for (const key of keys) {
    const match = await bcrypt.compare(rawKey, key.keyHash);
    if (match) {
      // Update lastUsedAt asynchronously (don't block response)
      prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      }).catch(() => {});

      return {
        clientId: key.clientId,
        keyId: key.id,
        scopes: key.scopes as string[],
      };
    }
  }

  return null;
}

const apiKeyAuthPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.decorate(
    "authenticateApiKey",
    async function (request: FastifyRequest, reply: FastifyReply) {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        // Try X-API-Key header as fallback
        const apiKeyHeader = request.headers["x-api-key"] as string | undefined;
        if (!apiKeyHeader) {
          return reply.status(401).send({
            error: "Missing API key. Use header: Authorization: Bearer lb_<your_key>",
          });
        }
        const result = await verifyApiKey(fastify.prisma, apiKeyHeader);
        if (!result) {
          return reply.status(401).send({ error: "Invalid or revoked API key" });
        }
        request.apiKeyAuth = result;
        return;
      }

      const token = authHeader.substring(7);
      const result = await verifyApiKey(fastify.prisma, token);
      if (!result) {
        return reply.status(401).send({ error: "Invalid or revoked API key" });
      }
      request.apiKeyAuth = result;
    }
  );
});

// Helper to check if request has required scope
export function requireScope(scope: string) {
  return function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.apiKeyAuth) {
      return reply.status(401).send({ error: "Not authenticated via API key" });
    }
    if (!request.apiKeyAuth.scopes.includes(scope)) {
      return reply.status(403).send({
        error: `Insufficient permissions. Required scope: ${scope}`,
      });
    }
  };
}

export default apiKeyAuthPlugin;

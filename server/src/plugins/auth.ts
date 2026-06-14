import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: string;
    role: "admin" | "client";
    clientId?: string;
  }
}

const authPlugin = fp(async (fastify: FastifyInstance) => {
  // Register JWT decorator
  fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.status(401).send({ error: "Missing or invalid authorization header" });
      }

      const token = authHeader.substring(7);
      const payload = jwt.verify(token, config.JWT_SECRET) as {
        sub: string;
        role: "admin" | "client";
        clientId?: string;
        type: string;
      };

      if (payload.type !== "access") {
        return reply.status(401).send({ error: "Invalid token type" });
      }

      request.userId = payload.sub;
      request.role = payload.role;
      request.clientId = payload.clientId;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return reply.status(401).send({ error: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return reply.status(401).send({ error: "Invalid token" });
    }
  });

  fastify.decorate("authenticateAdmin", async function (request: FastifyRequest, reply: FastifyReply) {
    await fastify.authenticate(request, reply);
    if (request.role !== "admin") {
      return reply.status(403).send({ error: "Admin access required" });
    }
  });
});

// Token generation helpers
export function generateAccessToken(payload: {
  sub: string;
  role: "admin" | "client";
  clientId?: string;
}): string {
  return jwt.sign(
    { ...payload, type: "access", iat: Math.floor(Date.now() / 1000) },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRY as SignOptions["expiresIn"] }
  );
}

export function generateRefreshToken(payload: {
  sub: string;
  role: "admin" | "client";
}): string {
  return jwt.sign(
    { ...payload, type: "refresh", iat: Math.floor(Date.now() / 1000) },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRY as SignOptions["expiresIn"] }
  );
}

export function verifyRefreshToken(token: string): { sub: string; role: string } | null {
  try {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as { type: string; sub: string; role: string };
    if (payload.type !== "refresh") return null;
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export default authPlugin;

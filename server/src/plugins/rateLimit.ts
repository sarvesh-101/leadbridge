import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

const rateLimitPlugin = fp(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    global: true,
    max: 60,
    timeWindow: "1 minute",
    allowList: ["GET /ws"], // Skip rate limiting for WebSocket upgrade
    keyGenerator: (request) => {
      // Rate limit by IP, or by user ID if authenticated
      return request.userId || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        error: "Too many requests",
        message: `Rate limit exceeded. Try again in ${context.after}`,
        retryAfter: context.after,
      };
    },
  });

  // Route-specific overrides can be applied in individual route handlers
});

export default rateLimitPlugin;

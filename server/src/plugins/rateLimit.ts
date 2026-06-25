import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

const rateLimitPlugin = fp(async (fastify: FastifyInstance) => {
  // Global rate limit (applies to all routes)
  await fastify.register(rateLimit, {
    global: true,
    max: 60, // 60 requests per minute for regular users
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

  // ─── Admin-specific rate limiting ───────────────────────
  // Tighter limits on admin routes to prevent brute-force attacks.
  // Fastify v4 onRoute fires with the plugin-relative URL (no prefix).
  fastify.addHook("onRoute", (routeOptions) => {
    const url = routeOptions.url || "";
    // Match both prefixed (/api/v1/admin) and unprefixed (/admin) in case
    // the hook fires before or after prefix resolution.
    if (url.includes("/admin")) {
      routeOptions.config = {
        ...routeOptions.config,
        rateLimit: {
          max: 20, // 20 requests per minute for admin endpoints
          timeWindow: "1 minute",
        },
      };
    }
  });
});

export default rateLimitPlugin;

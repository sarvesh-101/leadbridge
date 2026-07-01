import Redis from "ioredis";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { config } from "../config";
import { logger } from "../utils/logger";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis | null;
  }
}

/**
 * Redis Plugin
 * Provides a Redis client for caching, pub/sub, and queue operations.
 * In development mode, gracefully handles Redis being unavailable.
 */
const redisPlugin = fp(async (fastify: FastifyInstance) => {
  const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 3) {
        fastify.log.error("Redis max retries reached — disabling Redis");
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000);
    },
  });

  try {
    await redis.connect();
    fastify.log.info("Redis connected");

    redis.on("error", (err) => {
      fastify.log.error({ err }, "Redis connection error");
    });

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
      fastify.log.info("Redis disconnected");
    });
  } catch (err) {
    fastify.log.warn({ err }, "Redis unavailable — running without Redis");
    fastify.decorate("redis", null);
  }
});

export default redisPlugin;

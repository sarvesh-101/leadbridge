import Redis from "ioredis";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getSharedRedisOptions, noteRedisError } from "../utils/redis-health";

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
    ...getSharedRedisOptions(),
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    fastify.log.info("Redis connected");

    redis.on("error", (err) => {
      noteRedisError(err);
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

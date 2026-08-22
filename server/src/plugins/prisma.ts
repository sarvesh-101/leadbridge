import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin = fp(async (fastify: FastifyInstance) => {
  // Pool limit: Supabase session-mode pooler maxes at 15 connections.
  // BullMQ workers also hold connections, so keep the app pool small (default 5).
  const poolLimit = parseInt(process.env.PRISMA_POOL_LIMIT || "5", 10);

  const prisma = new PrismaClient({
    log: fastify.log.level === "info"
      ? ["error", "warn"]
      : ["error", "warn", "info"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL_PRISMA || process.env.DATABASE_URL,
        connectionLimit: poolLimit,
      },
    },
  });

  await prisma.$connect();
  fastify.log.info(`Prisma connected to PostgreSQL (pool: ${poolLimit})`);

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
    fastify.log.info("Prisma disconnected");
  });
});

export default prismaPlugin;

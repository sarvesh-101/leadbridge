import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin = fp(async (fastify: FastifyInstance) => {
  const prisma = new PrismaClient({
    log: fastify.log.level === "info"
      ? ["error", "warn"]
      : ["error", "warn", "info"],
  });

  await prisma.$connect();
  fastify.log.info("Prisma connected to PostgreSQL");

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
    fastify.log.info("Prisma disconnected");
  });
});

export default prismaPlugin;

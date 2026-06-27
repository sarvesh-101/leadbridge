/**
 * Shared Prisma Client — prevents connection pool exhaustion.
 *
 * Each worker file previously created its own PrismaClient instance.
 * At peak load, having 6+ concurrent workers each with their own pool
 * could hit PostgreSQL connection limits.
 *
 * Now all workers share a single PrismaClient via the singleton pattern.
 *
 * Usage:
 *   import { prisma } from "../utils/prisma-shared";
 */

import { PrismaClient } from "@prisma/client";

// Singleton: reuse the same PrismaClient across all files
const globalForPrisma = globalThis as unknown as {
  __prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on shutdown.
 * Call this from SIGTERM/SIGINT handlers.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

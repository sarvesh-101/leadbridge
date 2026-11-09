/**
 * V2 (T14) — recording retention sweep.
 *
 * RECORDING_RETENTION_DAYS unset (the default) ⇒ NO automatic deletion, ever.
 * When set, calls older than the window have their recording reference removed.
 * A human decides the retention period after legal review — this job only
 * executes the decision.
 */
import { prisma } from "../utils/prisma-shared";
import { config } from "../config";
import { logger } from "../utils/logger";

export async function runRecordingRetention(
  now = new Date(),
  db = prisma,
): Promise<{ days: number; cleared: number }> {
  const days = config.RECORDING_RETENTION_DAYS;
  if (!days || days <= 0) {
    return { days: 0, cleared: 0 };
  }

  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await db.call.updateMany({
    where: { createdAt: { lt: cutoff }, recordingUrl: { not: null } },
    data: { recordingUrl: null },
  });

  logger.info({ days, cutoff, cleared: result.count }, "Recording retention sweep complete");
  return { days, cleared: result.count };
}
export type { PrismaClient } from "@prisma/client";
export { prisma };

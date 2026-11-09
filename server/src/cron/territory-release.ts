/**
 * V2 (T13) — territory release rules. OFF BY DEFAULT.
 *
 * TERRITORY_AUTO_RELEASE_ENABLED=false (default): this job returns immediately
 * and nothing is ever released. The owner decides whether to enable it and what
 * the thresholds are (HUMAN GATE).
 *
 * When enabled:
 *   - a zone whose subscription was cancelled/lapsed for 30 days is released;
 *   - at 45 days a warning is logged/notified;
 *   - at 60 days it is released early if monthly leads < TERRITORY_MIN_MONTHLY_LEADS.
 */
import { prisma } from "../utils/prisma-shared";
import { config } from "../config";
import { logger } from "../utils/logger";

const DAY = 24 * 60 * 60 * 1000;

export interface TerritoryReleaseResult {
  enabled: boolean;
  warned: number;
  released: number;
}

export async function runTerritoryRelease(
  now = new Date(),
  db: typeof prisma = prisma
): Promise<TerritoryReleaseResult> {
  if (!config.TERRITORY_AUTO_RELEASE_ENABLED) {
    return { enabled: false, warned: 0, released: 0 };
  }

  const claimed = await db.territory.findMany({
    where: { clientId: { not: null }, status: "CLAIMED" },
    select: {
      id: true,
      clientId: true,
      updatedAt: true,
      client: {
        select: { id: true, planStatus: true, leadsThisMonth: true, email: true },
      },
    },
  });

  let warned = 0;
  let released = 0;

  for (const territory of claimed) {
    if (!territory.client) continue;
    if (territory.client.planStatus !== "CANCELLED") continue;

    const idleDays = Math.floor((now.getTime() - territory.updatedAt.getTime()) / DAY);

    if (idleDays >= 30 && idleDays < 45) {
      // 30-day grace elapsed: release per the default rule.
      await db.territory.update({
        where: { id: territory.id },
        data: { clientId: null, status: "AVAILABLE", locked: false },
      });
      released++;
      logger.info({ territoryId: territory.id }, "Territory released after 30-day cancellation grace");
      continue;
    }

    if (idleDays >= 45 && idleDays < 60) {
      warned++;
      logger.warn({ territoryId: territory.id, idleDays }, "Territory release warning (45 days)");
      continue;
    }

    if (idleDays >= 60 && territory.client.leadsThisMonth < config.TERRITORY_MIN_MONTHLY_LEADS) {
      await db.territory.update({
        where: { id: territory.id },
        data: { clientId: null, status: "AVAILABLE", locked: false },
      });
      released++;
      logger.info({ territoryId: territory.id, idleDays }, "Territory released (60 days, below minimum leads)");
    }
  }

  return { enabled: true, warned, released };
}

/**
 * Monthly Broker Credit Reset — runs at midnight on the 1st of every month.
 *
 * For each active broker:
 *   1. Unused calls (callsLimit - callsThisMonth) roll into rolloverCalls
 *   2. rolloverCaps capped at callsLimit × 3 (max 3 months' worth)
 *   3. callsThisMonth reset to 0
 *
 * Also logs a CreditTransaction for audit trail.
 */
import { prisma } from "../utils/prisma-shared";
import { monthlyBrokerCreditReset } from "../services/credit-manager.service";
import { logger } from "../utils/logger";

export async function runMonthlyReset(): Promise<{
  brokersProcessed: number;
  totalRolloverMinutes: number;
}> {
  logger.info("Monthly broker credit reset: Starting...");
  const result = await monthlyBrokerCreditReset(prisma);
  logger.info(
    { brokersProcessed: result.brokersProcessed, totalRolloverMinutes: result.totalRolloverMinutes },
    "Monthly broker credit reset: Complete"
  );
  return result;
}

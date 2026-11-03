/**
 * Monthly Broker Credit Reset — runs at midnight on the 1st of every month.
 *
 * For each active broker:
 *   1. Unused calls (callsLimit - callsThisMonth) roll into rolloverCalls
 *   2. rolloverCaps capped at callsLimit × 3 (max 3 months' worth)
 *   3. callsThisMonth reset to 0
 *
 * V2 (T2) additions:
 *   4. Per-lead fair-use metering (answeredSecondsThisCycle / fairUseCappedAt)
 *      resets with the cycle. Prepaid lead credits (prepaidLeads) are NEVER
 *      reset — purchased credits carry over.
 *   5. Leads held as QUEUED_WAITING_CREDITS get released in queue order once
 *      the fresh plan allowance is available.
 *
 * Also logs a CreditTransaction for audit trail.
 */
import { prisma } from "../utils/prisma-shared";
import { monthlyBrokerCreditReset } from "../services/credit-manager.service";
import { releaseWaitingLeads } from "../utils/lead-limits";
import { logger } from "../utils/logger";

export async function runMonthlyReset(): Promise<{
  brokersProcessed: number;
  totalRolloverMinutes: number;
  leadsFairUseReset: number;
  waitingLeadsReleased: number;
}> {
  logger.info("Monthly broker credit reset: Starting...");
  const result = await monthlyBrokerCreditReset(prisma);

  // ─── V2 (T2): reset per-lead fair-use metering with the cycle ─────
  const leadsFairUseReset = await prisma.lead.updateMany({
    where: {
      OR: [{ answeredSecondsThisCycle: { gt: 0 } }, { fairUseCappedAt: { not: null } }],
    },
    data: { answeredSecondsThisCycle: 0, fairUseCappedAt: null },
  });

  // ─── V2 (T2): fresh allowance — release held leads (queue order) ──
  let waitingLeadsReleased = 0;
  const clientsWithHeld = await prisma.client.findMany({
    where: { leads: { some: { status: "QUEUED_WAITING_CREDITS" } } },
    select: { id: true, plan: true },
  });
  for (const client of clientsWithHeld) {
    waitingLeadsReleased += await releaseWaitingLeads(prisma, client.id, client.plan);
  }

  logger.info(
    {
      brokersProcessed: result.brokersProcessed,
      totalRolloverMinutes: result.totalRolloverMinutes,
      leadsFairUseReset: leadsFairUseReset.count,
      waitingLeadsReleased,
    },
    "Monthly broker credit reset: Complete"
  );
  return {
    brokersProcessed: result.brokersProcessed,
    totalRolloverMinutes: result.totalRolloverMinutes,
    leadsFairUseReset: leadsFairUseReset.count,
    waitingLeadsReleased,
  };
}

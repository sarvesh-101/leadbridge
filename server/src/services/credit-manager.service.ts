/**
 * Credit Manager Service
 *
 * Manages TWO credit layers:
 *   1. PLATFORM CREDITS — Global minutes purchased from OmniDimension.
 *      Tracks: how much the platform spends on AI calls.
 *   2. BROKER CREDITS  — Per-broker call allowance based on their plan.
 *      Tracks: callsThisMonth + rolloverCalls (unused from prev months, capped at 3x).
 *
 * Rollover Model:
 *   - Each month, unused calls (callsLimit - callsThisMonth) roll into rolloverCalls.
 *   - rolloverCalls is capped at callsLimit × 3 (max 3 months' worth).
 *   - callsThisMonth resets to 0 each month.
 *   - prepaidCalls: Purchased call credits (via offline payments). NEVER expire.
 *   - Total available = prepaidCalls + rolloverCalls + max(0, callsLimit - callsThisMonth).
 *   - Consumption order: prepaidCalls → rolloverCalls → callsLimit (monthly).
 *   - HARD STOP: When total available reaches 0, calls are blocked.
 *   - 80% warning: Alert broker when they've used 80% of their monthly allocation.
 */

import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { logger } from "../utils/logger";

const COST_PER_MINUTE = config.OMNIDIM_COST_PER_MINUTE;
const AVG_CALL_MINUTES = config.AVG_CALL_DURATION_MINUTES;
const WARN_THRESHOLD_PERCENT = config.CREDIT_WARN_THRESHOLD_PERCENT;

// ─────────────────────────────────────────────
// PLATFORM CREDIT FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Get or create the current billing month's PlatformCredit record.
 */
export async function getOrCreateCurrentCredit(prisma: PrismaClient) {
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const credit = await prisma.platformCredit.upsert({
    where: { billingMonth },
    create: {
      billingMonth,
      totalMinutesPurchased: 0,
      minutesUsed: 0,
      costPerMinute: COST_PER_MINUTE,
      costPerPhoneMonthly: config.PHONE_NUMBER_MONTHLY_COST,
      alertThresholdPercent: WARN_THRESHOLD_PERCENT,
    },
    update: {},
  });

  return credit;
}

/**
 * Check if the platform has enough credits to dispatch a call.
 * Returns { canProceed: boolean, reason?: string }
 */
export async function canDispatchCall(prisma: PrismaClient): Promise<{
  canProceed: boolean;
  reason?: string;
  minutesRemaining?: number;
  minutesAvailable?: number;
}> {
  const credit = await getOrCreateCurrentCredit(prisma);

  if (credit.totalMinutesPurchased === 0) {
    return {
      canProceed: true,
      reason: "Platform credits not configured — allowing call",
      minutesAvailable: 0,
      minutesRemaining: 0,
    };
  }

  const minutesRemaining = credit.totalMinutesPurchased - credit.minutesUsed;
  const estimatedCallMinutes = AVG_CALL_MINUTES;

  if (minutesRemaining < estimatedCallMinutes) {
    return {
      canProceed: false,
      reason: `Platform credits exhausted (${minutesRemaining} min remaining, need ~${estimatedCallMinutes} min per call)`,
      minutesRemaining,
      minutesAvailable: credit.totalMinutesPurchased,
    };
  }

  return {
    canProceed: true,
    minutesRemaining,
    minutesAvailable: credit.totalMinutesPurchased,
  };
}

// ─────────────────────────────────────────────
// BROKER CREDIT FUNCTIONS
// ─────────────────────────────────────────────

/**
 * Get a broker's total available call credits.
 * Total = callsLimit (base monthly) + rolloverCalls (unused from prev months) - callsThisMonth (used)
 */
export async function getBrokerCredits(
  prisma: PrismaClient,
  clientId: string
): Promise<{
  callsLimit: number;
  callsThisMonth: number;
  rolloverCalls: number;
  prepaidCalls: number;
  totalAvailable: number;
  totalRemaining: number;
  usagePercent: number;
  needsWarning: boolean;
}> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { callsLimit: true, callsThisMonth: true, rolloverCalls: true, prepaidCalls: true },
  });

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  const monthlyRemaining = Math.max(0, client.callsLimit - client.callsThisMonth);
  const totalAvailable = client.prepaidCalls + client.rolloverCalls + monthlyRemaining;
  const totalRemaining = Math.max(0, totalAvailable);
  const usageTotal = client.callsThisMonth;
  const usagePercent = totalAvailable > 0
    ? Math.round((usageTotal / totalAvailable) * 100)
    : 0;

  // Warn at 80% usage of the BASE monthly allocation (not total available)
  const monthlyUsagePercent = client.callsLimit > 0
    ? Math.round((client.callsThisMonth / client.callsLimit) * 100)
    : 0;
  const needsWarning = monthlyUsagePercent >= 80;

  return {
    callsLimit: client.callsLimit,
    callsThisMonth: client.callsThisMonth,
    rolloverCalls: client.rolloverCalls,
    prepaidCalls: client.prepaidCalls,
    totalAvailable,
    totalRemaining,
    usagePercent,
    needsWarning,
  };
}

/**
 * Check if a broker can dispatch a call based on their credit balance.
 * HARD STOP: When total remaining hits 0, no more calls.
 */
export async function canBrokerDispatchCall(
  prisma: PrismaClient,
  clientId: string
): Promise<{
  canProceed: boolean;
  reason?: string;
  credits: {
    callsLimit: number;
    callsThisMonth: number;
    rolloverCalls: number;
    totalAvailable: number;
    totalRemaining: number;
    usagePercent: number;
  };
  needsWarning: boolean;
}> {
  const credits = await getBrokerCredits(prisma, clientId);

  if (credits.totalRemaining <= 0) {
    return {
      canProceed: false,
      reason: `Monthly call limit reached. You've used all ${credits.totalAvailable} available calls (${credits.callsLimit} plan + ${credits.rolloverCalls} rolled over). Upgrade your plan or wait for next month's reset.`,
      credits,
      needsWarning: false,
    };
  }

  return {
    canProceed: true,
    credits,
    needsWarning: credits.needsWarning,
  };
}

/**
 * Increment broker's call counter when a call is dispatched.
 * Uses ATOMIC updates (updateMany with where) to prevent race conditions:
 *   1. prepaidCalls (purchased credits, never expire)
 *   2. rolloverCalls (unused from prev months)
 *   3. callsThisMonth (current month's plan allowance)
 */
export async function incrementBrokerCallCount(
  prisma: PrismaClient,
  clientId: string
): Promise<void> {
  // Atomic: only updates if prepaidCalls > 0
  const result = await prisma.client.updateMany({
    where: { id: clientId, prepaidCalls: { gt: 0 } },
    data: { prepaidCalls: { decrement: 1 } },
  });
  if (result.count > 0) return;

  // Atomic: only updates if rolloverCalls > 0
  const result2 = await prisma.client.updateMany({
    where: { id: clientId, rolloverCalls: { gt: 0 } },
    data: { rolloverCalls: { decrement: 1 } },
  });
  if (result2.count > 0) return;

  // Fallback: monthly plan allowance
  await prisma.client.update({
    where: { id: clientId },
    data: { callsThisMonth: { increment: 1 } },
  });
}

/**
 * Monthly reset for ALL active brokers.
 * - Unused calls (callsLimit - callsThisMonth) roll into rolloverCalls
 * - rolloverCalls capped at callsLimit × 3
 * - callsThisMonth reset to 0
 * - Also records broker revenue in CreditTransaction for profitability tracking
 */
export async function monthlyBrokerCreditReset(prisma: PrismaClient): Promise<{
  brokersProcessed: number;
  totalRolloverMinutes: number;
}> {
  const brokers = await prisma.client.findMany({
    where: { planStatus: { in: ["TRIAL", "ACTIVE"] } },
    select: { id: true, callsLimit: true, callsThisMonth: true, rolloverCalls: true, totalRevenueGenerated: true, plan: true },
  });

  let totalRollover = 0;
  for (const broker of brokers) {
    const unused = Math.max(0, broker.callsLimit - broker.callsThisMonth);
    const newRollover = Math.min(broker.rolloverCalls + unused, broker.callsLimit * 3);

    await prisma.client.update({
      where: { id: broker.id },
      data: {
        callsThisMonth: 0,
        rolloverCalls: newRollover,
      },
    });

    totalRollover += newRollover;

    // Log the rollover
    await prisma.creditTransaction.create({
      data: {
        type: "OVERRIDE",
        amount: 0,
        minutes: newRollover,
        description: `Monthly reset: ${unused} unused calls rolled over (total rollover: ${newRollover})`,
        clientId: broker.id,
        metadata: {
          plan: broker.plan,
          callsLimit: broker.callsLimit,
          callsUsed: broker.callsThisMonth,
          unused,
          newRollover,
          revenueGenerated: broker.totalRevenueGenerated,
        },
      },
    });
  }

  logger.info(
    { brokersProcessed: brokers.length, totalRollover },
    "Monthly broker credit reset complete"
  );

  return { brokersProcessed: brokers.length, totalRolloverMinutes: totalRollover };
}

// ─────────────────────────────────────────────
// CALL COST TRACKING (existing)
// ─────────────────────────────────────────────

export async function recordCallCost(
  prisma: PrismaClient,
  params: { clientId: string; callId: string; leadId?: string; durationMinutes: number }
) {
  const { clientId, callId, leadId, durationMinutes } = params;
  const callCost = Math.round(durationMinutes * COST_PER_MINUTE * 100) / 100;

  const credit = await getOrCreateCurrentCredit(prisma);
  await prisma.platformCredit.update({
    where: { id: credit.id },
    data: { minutesUsed: { increment: Math.ceil(durationMinutes) } },
  });

  await prisma.creditTransaction.create({
    data: {
      type: "CONSUME",
      amount: callCost,
      minutes: Math.ceil(durationMinutes),
      description: `Call cost: ${durationMinutes}min × ₹${COST_PER_MINUTE}/min = ₹${callCost}`,
      clientId,
      callId,
      metadata: { durationMinutes, costPerMinute: COST_PER_MINUTE, totalCost: callCost },
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { totalCostIncurred: { increment: callCost } },
  });

  // FIX #4: Track per-lead cost
  if (leadId) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { platformCost: { increment: callCost } },
    });
  }

  logger.info({ clientId, callCost, durationMinutes, leadId }, `Call cost tracked: ₹${callCost} for ${durationMinutes}min`);
  return { callCost, durationMinutes };
}

export async function recordBrokerRevenue(
  prisma: PrismaClient,
  params: { clientId: string; amount: number; description: string }
) {
  const { clientId, amount, description } = params;
  await prisma.client.update({
    where: { id: clientId },
    data: { totalRevenueGenerated: { increment: amount } },
  });
  await prisma.creditTransaction.create({
    data: { type: "PURCHASE", amount, minutes: 0, description, clientId, metadata: { revenue: amount } },
  });
  logger.info({ clientId, amount }, `Broker revenue recorded: ₹${amount}`);
}

export async function topUpCredits(
  prisma: PrismaClient,
  params: { minutes: number; totalCost: number; description?: string }
) {
  const credit = await getOrCreateCurrentCredit(prisma);
  const existingMin = credit.totalMinutesPurchased;
  const existingCost = existingMin > 0 ? existingMin * credit.costPerMinute : 0;
  const newTotalMinutes = existingMin + params.minutes;
  const newTotalCost = existingCost + params.totalCost;
  const weightedAvgCostPerMin = Math.round((newTotalCost / newTotalMinutes) * 100) / 100;

  const updated = await prisma.platformCredit.update({
    where: { id: credit.id },
    data: {
      totalMinutesPurchased: { increment: params.minutes },
      costPerMinute: weightedAvgCostPerMin,
      lastRechargedAt: new Date(),
    },
  });

  await prisma.creditTransaction.create({
    data: {
      type: "PURCHASE",
      amount: params.totalCost,
      minutes: params.minutes,
      description: params.description || `Platform top-up: ${params.minutes} min for ₹${params.totalCost}`,
      metadata: { costPerMinute: params.totalCost / params.minutes, totalMinutesAfter: updated.totalMinutesPurchased },
    },
  });

  logger.info({ minutes: params.minutes, totalCost: params.totalCost }, `Platform credits topped up: ${params.minutes} min for ₹${params.totalCost}`);
  return updated;
}

export async function checkCreditHealth(prisma: PrismaClient) {
  const credit = await getOrCreateCurrentCredit(prisma);
  const minutesPurchased = credit.totalMinutesPurchased;
  const minutesUsed = credit.minutesUsed;
  const minutesRemaining = minutesPurchased - minutesUsed;
  const remainingPercent = minutesPurchased > 0 ? Math.round((minutesRemaining / minutesPurchased) * 100) : 100;

  const purchases = await prisma.creditTransaction.findMany({
    where: { type: "PURCHASE" },
    select: { amount: true },
  });
  const totalCost = purchases.reduce((sum, t) => sum + t.amount, 0);
  const effectiveCostPerMinute = minutesUsed > 0 ? Math.round((totalCost / minutesUsed) * 100) / 100 : credit.costPerMinute;
  const needsAlert = minutesPurchased > 0 && remainingPercent <= WARN_THRESHOLD_PERCENT;

  return {
    needsAlert,
    remainingPercent,
    minutesRemaining: Math.max(0, minutesRemaining),
    minutesPurchased,
    minutesUsed,
    totalCost,
    effectiveCostPerMinute,
  };
}

export async function getBrokerCostAnalysis(prisma: PrismaClient) {
  const brokers = await prisma.client.findMany({
    where: { planStatus: { in: ["ACTIVE", "TRIAL"] } },
    select: {
      id: true,
      businessName: true,
      ownerName: true,
      email: true,
      plan: true,
      planStatus: true,
      callsThisMonth: true,
      callsLimit: true,
      rolloverCalls: true,
      prepaidCalls: true,
      totalCostIncurred: true,
      totalRevenueGenerated: true,
      phoneCostMonthly: true,
      phoneSetupStatus: true,
      createdAt: true,
    },
    orderBy: { totalCostIncurred: "desc" },
    take: 100,
  });

  return brokers.map((b) => {
    // FIX #3 (P1): Include phone number cost in per-broker cost analysis
    const phoneCost = b.phoneCostMonthly || 0;
    const totalCostWithPhone = b.totalCostIncurred + phoneCost;

    const margin = b.totalRevenueGenerated - totalCostWithPhone;
    const marginPercent = b.totalRevenueGenerated > 0
      ? Math.round((margin / b.totalRevenueGenerated) * 100)
      : 0;
    const costPerCall = b.callsThisMonth > 0
      ? Math.round((totalCostWithPhone / b.callsThisMonth) * 100) / 100
      : 0;
    const monthlyRemaining = Math.max(0, b.callsLimit - b.callsThisMonth);
    const totalAvailable = b.prepaidCalls + b.rolloverCalls + monthlyRemaining;
    const remaining = Math.max(0, totalAvailable);

    return {
      id: b.id,
      businessName: b.businessName,
      ownerName: b.ownerName,
      email: b.email,
      plan: b.plan,
      planStatus: b.planStatus,
      callsUsed: b.callsThisMonth,
      callsLimit: b.callsLimit,
      rolloverCalls: b.rolloverCalls,
      prepaidCalls: b.prepaidCalls,
      totalAvailable,
      remaining,
      costIncurred: totalCostWithPhone,
      callCostOnly: b.totalCostIncurred,
      phoneCost,
      revenueGenerated: b.totalRevenueGenerated,
      profit: margin,
      profitMarginPercent: marginPercent,
      costPerCall,
      phoneSetupStatus: b.phoneSetupStatus,
      joinedAt: b.createdAt,
    };
  });
}

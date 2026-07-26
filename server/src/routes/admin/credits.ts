/**
 * Admin Credit Management Routes
 *
 * GET  /admin/credits/overview    — Platform credit health & usage summary
 * GET  /admin/credits/brokers     — Per-broker cost & profitability analysis
 * POST /admin/credits/top-up      — Record a platform credit top-up
 * GET  /admin/credits/transactions — Credit transaction log
 * POST /admin/credits/reset       — Reset billing month (when month changes)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  topUpCredits,
  checkCreditHealth,
  getBrokerCostAnalysis,
  getOrCreateCurrentCredit,
} from "../../services/credit-manager.service";
import { purchaseCredits } from "../../services/omnidimension.service";

export default async function adminCreditRoutes(fastify: FastifyInstance) {
  // All routes require admin auth
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── Platform Credit Overview ───────────────────────────────────
  fastify.get("/admin/credits/overview", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await checkCreditHealth(fastify.prisma);
      const credit = await getOrCreateCurrentCredit(fastify.prisma);
      const transactions = await fastify.prisma.creditTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return {
        credit: {
          billingMonth: credit.billingMonth,
          totalMinutesPurchased: health.minutesPurchased,
          minutesUsed: health.minutesUsed,
          minutesRemaining: health.minutesRemaining,
          remainingPercent: health.remainingPercent,
          totalCost: health.totalCost,
          effectiveCostPerMinute: health.effectiveCostPerMinute,
          costPerMinute: credit.costPerMinute,
          costPerPhoneMonthly: credit.costPerPhoneMonthly,
          phoneNumbersActive: credit.phoneNumbersActive,
          lastRechargedAt: credit.lastRechargedAt,
          alertThresholdPercent: credit.alertThresholdPercent,
          needsAlert: health.needsAlert,
        },
        recentTransactions: transactions,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch credit overview" });
    }
  });

  // ─── Per-Broker Cost Analysis ──────────────────────────────────
  fastify.get("/admin/credits/brokers", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const brokers = await getBrokerCostAnalysis(fastify.prisma);

      const totals = brokers.reduce(
        (acc, b) => ({
          totalCost: acc.totalCost + b.costIncurred,
          totalRevenue: acc.totalRevenue + b.revenueGenerated,
          totalProfit: acc.totalProfit + b.profit,
          totalBrokers: acc.totalBrokers + 1,
          brokersInProfit: acc.brokersInProfit + (b.profit > 0 ? 1 : 0),
        }),
        { totalCost: 0, totalRevenue: 0, totalProfit: 0, totalBrokers: 0, brokersInProfit: 0 }
      );

      return {
        brokers,
        summary: {
          totalBrokers: totals.totalBrokers,
          totalCost: Math.round(totals.totalCost * 100) / 100,
          totalRevenue: Math.round(totals.totalRevenue * 100) / 100,
          totalProfit: Math.round(totals.totalProfit * 100) / 100,
          brokersInProfit: totals.brokersInProfit,
          brokersInLoss: totals.totalBrokers - totals.brokersInProfit,
          overallMarginPercent: totals.totalRevenue > 0
            ? Math.round((totals.totalProfit / totals.totalRevenue) * 100)
            : 0,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch broker costs" });
    }
  });

  // ─── Top Up Credits ────────────────────────────────────────────
  fastify.post("/admin/credits/top-up", {
    schema: {
      body: {
        type: "object",
        required: ["minutes", "totalCost"],
        properties: {
          minutes: { type: "integer", minimum: 1 },
          totalCost: { type: "number", minimum: 0 },
          description: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { minutes: number; totalCost: number; description?: string };
  }>, reply: FastifyReply) => {
    try {
      const { minutes, totalCost, description } = request.body;

      const updated = await topUpCredits(fastify.prisma, {
        minutes,
        totalCost,
        description: description || undefined,
      });

      // NOTE: OmniDimension has no public purchase API.
      // Admin must buy credits at https://omnidim.io dashboard.
      // The local record is updated here; OmniDimension sync is advisory.
      const omniResult = await purchaseCredits({ minutes, amount: totalCost }).catch((err: any) => ({
        success: false,
        message: err.message,
      }));

      if (!omniResult.success) {
        fastify.log.warn(
          { minutes, totalCost },
          "OmniDimension credit purchase requires manual action — buy at omnidim.io dashboard"
        );
      }

      return {
        success: true,
        credit: {
          id: updated.id,
          totalMinutesPurchased: updated.totalMinutesPurchased,
          minutesUsed: updated.minutesUsed,
          costPerMinute: updated.costPerMinute,
          lastRechargedAt: updated.lastRechargedAt,
        },
        // Inform the admin about the manual purchase requirement
        message: "Credits recorded locally. To use them on OmniDimension, purchase minutes at https://omnidim.io dashboard.",
        omniDimension: omniResult,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to top up credits" });
    }
  });

  // ─── Credit Transaction Log ────────────────────────────────────
  fastify.get("/admin/credits/transactions", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page = "1", limit = "50", type } = request.query as Record<string, string>;

      const where: Record<string, unknown> = {};
      if (type && ["PURCHASE", "CONSUME", "OVERRIDE"].includes(type)) {
        where.type = type;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [transactions, total] = await Promise.all([
        fastify.prisma.creditTransaction.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
        }),
        fastify.prisma.creditTransaction.count({ where }),
      ]);

      return {
        transactions,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch transactions" });
    }
  });

  // ─── Reset Billing Month ──────────────────────────────────────
  fastify.post("/admin/credits/reset", {
    schema: {
      body: {
        type: "object",
        properties: {
          confirm: { type: "boolean" },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { confirm: boolean } }>, reply: FastifyReply) => {
    if (!request.body?.confirm) {
      return reply.status(400).send({ error: "Must set confirm=true to reset billing month" });
    }

    try {
      // Current month's credits remain as history
      const oldCredit = await getOrCreateCurrentCredit(fastify.prisma);

      // Create new month with zero balance
      const now = new Date();
      const newMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // Don't reset if we're already in the right month
      if (oldCredit.billingMonth === newMonth) {
        return reply.status(400).send({ error: `Already in billing month ${newMonth}` });
      }

      await fastify.prisma.platformCredit.create({
        data: {
          billingMonth: newMonth,
          totalMinutesPurchased: oldCredit.totalMinutesPurchased, // Carry over remaining minutes
          minutesUsed: oldCredit.minutesUsed,
          costPerMinute: oldCredit.costPerMinute,
          costPerPhoneMonthly: oldCredit.costPerPhoneMonthly,
          alertThresholdPercent: oldCredit.alertThresholdPercent,
          lastRechargedAt: oldCredit.lastRechargedAt,
        },
      });

      // Log the rollover
      await fastify.prisma.creditTransaction.create({
        data: {
          type: "OVERRIDE",
          amount: 0,
          minutes: 0,
          description: `Billing month rolled over from ${oldCredit.billingMonth} to ${newMonth}`,
          metadata: {
            previousMonth: oldCredit.billingMonth,
            newMonth,
            carriedOverMinutes: oldCredit.totalMinutesPurchased - oldCredit.minutesUsed,
          },
        },
      });

      return { success: true, billingMonth: newMonth };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to reset billing month" });
    }
  });
}

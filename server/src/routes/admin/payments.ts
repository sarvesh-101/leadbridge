/**
 * Admin Payment & Broker Credit Routes
 *
 * FIX for critical gaps in offline payment → credit conversion pipeline:
 *
 * GAP A: POST /admin/payments/manual — Record an offline payment (bank transfer, cheque, cash)
 *   - Creates PAID invoice (with GST)
 *   - Adds prepaidCalls to broker
 *   - Generates GST invoice PDF
 *   - Records revenue + audit trail
 *
 * GAP C: POST /admin/broker/add-credits — Manually add credits (promotional, adjustments)
 *   - Adds prepaidCalls without creating an invoice
 *
 * GAP E: GET /admin/broker/:id/credits — View broker credit history
 *   - Shows all credit sources + transactions
 *
 * GAP I: GET /admin/credits/alerts — Platform credit monitoring alerts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../../config";

export default async function adminPaymentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticateAdmin);

  // ─── GAP A: Record Offline Payment → Add Credits ───────────────
  // Broker paid via bank transfer/cheque/cash.
  // Admin records the payment, system creates PAID invoice + adds prepaidCalls.
  fastify.post("/admin/payments/manual", {
    schema: {
      body: {
        type: "object",
        required: ["clientId", "amount", "paymentMethod", "callsToAdd"],
        properties: {
          clientId: { type: "string" },
          amount: { type: "number", minimum: 1 },
          paymentMethod: { type: "string", enum: ["bank_transfer", "cheque", "cash", "other"] },
          paymentReference: { type: "string" },
          callsToAdd: { type: "integer", minimum: 1 },
          notes: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: {
      clientId: string;
      amount: number;
      paymentMethod: string;
      paymentReference?: string;
      callsToAdd: number;
      notes?: string;
    };
  }>, reply: FastifyReply) => {
    try {
      const { clientId, amount, paymentMethod, paymentReference, notes } = request.body;
      let callsToAdd = request.body.callsToAdd;

      // Auto-calculate calls from amount if not specified (GAP D: BROKER_CALL_PRICE)
      if (!callsToAdd || callsToAdd < 1) {
        callsToAdd = Math.max(1, Math.floor(amount / config.BROKER_CALL_PRICE));
      }

      // Validate client
      const client = await fastify.prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, businessName: true, ownerName: true, email: true, planStatus: true },
      });

      if (!client) {
        return reply.status(404).send({ error: "Client not found" });
      }

      // Calculate GST
      const gstRate = 18;
      const taxableAmount = Math.round((amount / (1 + gstRate / 100)) * 100) / 100;
      const gstAmount = Math.round((amount - taxableAmount) * 100) / 100;

      // Create PAID invoice
      const invoiceNumber = `INV-${Date.now()}-${clientId.slice(-4)}`;
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 7);

      const invoice = await fastify.prisma.invoice.create({
        data: {
          clientId,
          invoiceNumber,
          status: "PAID",
          description: `Manual payment: ${paymentMethod.replace("_", " ")} — ${callsToAdd} calls credited`,
          amount: taxableAmount,
          totalAmount: amount,
          taxableAmount,
          gstAmount,
          gstPercentage: gstRate,
          issueDate: now,
          dueDate,
          paidAt: now,
          paymentMethod,
          paymentReference: paymentReference || null,
          adminNotes: notes || null,
          billingName: client.ownerName,
          billingEmail: client.email,
        },
      });

      // Add prepaid calls to broker
      await fastify.prisma.client.update({
        where: { id: clientId },
        data: {
          prepaidCalls: { increment: callsToAdd },
          totalRevenueGenerated: { increment: amount },
          // Always reactivate on payment received
          planStatus: client.planStatus === "PAST_DUE" ? "ACTIVE" : client.planStatus,
        },
      });

      // Record audit trail in CreditTransaction
      await fastify.prisma.creditTransaction.create({
        data: {
          type: "PURCHASE",
          amount,
          minutes: callsToAdd,
          description: `Offline payment: ${paymentMethod.replace("_", " ")} ₹${amount} for ${callsToAdd} calls. Ref: ${paymentReference || "N/A"}. Notes: ${notes || "—"}`,
          clientId,
          metadata: {
            paymentMethod,
            paymentReference,
            callsToAdd,
            invoiceNumber,
            adminId: request.userId,
          },
        },
      });

      // Auto-generate GST invoice PDF (non-blocking)
      try {
        const { generateGstInvoiceForInvoice } = await import("../../services/invoice.service");
        generateGstInvoiceForInvoice(fastify.prisma, invoice.id).catch((err: any) =>
          fastify.log.warn({ err: err.message, invoiceId: invoice.id }, "GST invoice generation deferred")
        );
      } catch {
        // Invoice service not available — skip PDF generation
      }

      fastify.log.info(
        { clientId, amount, callsToAdd, paymentMethod, invoiceNumber },
        "Offline payment recorded — credits added"
      );

      return {
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber,
          amount,
          callsToAdd,
          paymentMethod,
        },
        message: `Payment of ₹${amount} recorded. ${callsToAdd} call credits added to ${client.businessName}.`,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to record payment" });
    }
  });

  // ─── GAP C: Manually Add Broker Credits (without invoice) ──────
  // For promotional credits, adjustments, or when payment was recorded externally.
  fastify.post("/admin/broker/add-credits", {
    schema: {
      body: {
        type: "object",
        required: ["clientId", "calls", "reason"],
        properties: {
          clientId: { type: "string" },
          callsToAdd: { type: "integer", minimum: 1 },
          reason: { type: "string", minLength: 3 },
          paymentReference: { type: "string" },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { clientId: string; calls: number; reason: string; paymentReference?: string };
  }>, reply: FastifyReply) => {
    try {
      const { clientId, calls, reason, paymentReference } = request.body;

      const client = await fastify.prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, businessName: true, prepaidCalls: true },
      });

      if (!client) {
        return reply.status(404).send({ error: "Client not found" });
      }

      // Add prepaid calls
      await fastify.prisma.client.update({
        where: { id: clientId },
        data: { prepaidCalls: { increment: calls } },
      });

      // Audit trail
      await fastify.prisma.creditTransaction.create({
        data: {
          type: "PURCHASE",
          amount: 0,
          minutes: calls,
          description: `Manual credit: ${reason}. Ref: ${paymentReference || "N/A"}. Previous prepaid: ${client.prepaidCalls}`,
          clientId,
          metadata: {
            reason,
            callsAdded: calls,
            paymentReference,
            adminId: request.userId,
            previousPrepaid: client.prepaidCalls,
            newPrepaid: client.prepaidCalls + calls,
          },
        },
      });

      fastify.log.info(
        { clientId, calls, reason },
        "Manual broker credits added"
      );

      return {
        success: true,
        clientId,
        callsAdded: calls,
        newPrepaidBalance: client.prepaidCalls + calls,
        reason,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to add credits" });
    }
  });

  // ─── GAP E: View Broker Credit History ─────────────────────────
  fastify.get("/admin/broker/:id/credits", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    try {
      const client = await fastify.prisma.client.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          businessName: true,
          ownerName: true,
          plan: true,
          planStatus: true,
          callsLimit: true,
          callsThisMonth: true,
          rolloverCalls: true,
          prepaidCalls: true,
          totalCostIncurred: true,
          totalRevenueGenerated: true,
        },
      });

      if (!client) {
        return reply.status(404).send({ error: "Client not found" });
      }

      // Get all credit transactions for this broker
      const transactions = await fastify.prisma.creditTransaction.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      // Get recent invoices
      const invoices = await fastify.prisma.invoice.findMany({
        where: { clientId: client.id },
        orderBy: { issueDate: "desc" },
        take: 20,
      });

      const monthlyRemaining = Math.max(0, client.callsLimit - client.callsThisMonth);
      const totalAvailable = client.prepaidCalls + client.rolloverCalls + monthlyRemaining;

      // Calculate effective call price
      const effectivePrice = client.totalRevenueGenerated > 0 && (client.callsLimit + client.rolloverCalls + client.prepaidCalls) > 0
        ? Math.round(client.totalRevenueGenerated / (client.callsLimit + client.rolloverCalls + client.prepaidCalls))
        : 0;

      return {
        broker: {
          name: client.businessName,
          owner: client.ownerName,
          plan: client.plan,
          status: client.planStatus,
        },
        credits: {
          prepaidCalls: client.prepaidCalls,     // Purchased, never expire
          rolloverCalls: client.rolloverCalls,     // Unused monthly, capped
          monthlyLimit: client.callsLimit,
          usedThisMonth: client.callsThisMonth,
          monthlyRemaining,
          totalAvailable,
          effectiveCostPerCall: effectivePrice,
          totalRevenue: client.totalRevenueGenerated,
          totalCost: client.totalCostIncurred,
          profit: client.totalRevenueGenerated - client.totalCostIncurred,
        },
        recentTransactions: transactions.map((t) => ({
          type: t.type,
          amount: t.amount,
          calls: t.minutes,
          description: t.description,
          date: t.createdAt,
        })),
        recentInvoices: invoices.map((i) => ({
          invoiceNumber: i.invoiceNumber,
          status: i.status,
          amount: i.totalAmount,
          paymentMethod: i.paymentMethod,
          paymentReference: i.paymentReference,
          date: i.issueDate,
          paidAt: i.paidAt,
        })),
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch broker credits" });
    }
  });

  // ─── GAP I: Platform Credit Monitoring ─────────────────────────
  // Alert admin about low platform minutes + broker details
  fastify.get("/admin/credits/alerts", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { checkCreditHealth } = await import("../../services/credit-manager.service");
      const health = await checkCreditHealth(fastify.prisma);

      // Find brokers with low or exhausted credits
      const lowCreditBrokers = await fastify.prisma.client.findMany({
        where: {
          planStatus: "ACTIVE",
          prepaidCalls: { lte: 5 },
        },
        select: {
          id: true,
          businessName: true,
          prepaidCalls: true,
          rolloverCalls: true,
          callsThisMonth: true,
          callsLimit: true,
          plan: true,
        },
      });

      const exhaustedBrokers = lowCreditBrokers.filter(
        (b) => b.prepaidCalls + b.rolloverCalls + Math.max(0, b.callsLimit - b.callsThisMonth) <= 0
      );

      return {
        platform: {
          minutesRemaining: health.minutesRemaining,
          minutesUsed: health.minutesUsed,
          minutesPurchased: health.minutesPurchased,
          remainingPercent: health.remainingPercent,
          needsTopUp: health.needsAlert,
        },
        lowCreditBrokers: lowCreditBrokers.map((b) => ({
          id: b.id,
          name: b.businessName,
          plan: b.plan,
          prepaidCalls: b.prepaidCalls,
          totalRemaining: b.prepaidCalls + b.rolloverCalls + Math.max(0, b.callsLimit - b.callsThisMonth),
          isExhausted: b.prepaidCalls + b.rolloverCalls + Math.max(0, b.callsLimit - b.callsThisMonth) <= 0,
        })),
        exhaustedCount: exhaustedBrokers.length,
        lowCreditCount: lowCreditBrokers.length - exhaustedBrokers.length,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch alerts" });
    }
  });

  // ─── List All Brokers with Prepaid Balance ──────────────────────
  fastify.get("/admin/broker/credits", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const brokers = await fastify.prisma.client.findMany({
        where: { planStatus: { in: ["ACTIVE", "TRIAL"] } },
        select: {
          id: true,
          businessName: true,
          ownerName: true,
          email: true,
          plan: true,
          planStatus: true,
          callsLimit: true,
          callsThisMonth: true,
          rolloverCalls: true,
          prepaidCalls: true,
        },
        orderBy: { prepaidCalls: "desc" },
      });

      return {
        brokers: brokers.map((b) => ({
          id: b.id,
          name: b.businessName,
          owner: b.ownerName,
          email: b.email,
          plan: b.plan,
          status: b.planStatus,
          prepaidCalls: b.prepaidCalls,
          rolloverCalls: b.rolloverCalls,
          monthlyRemaining: Math.max(0, b.callsLimit - b.callsThisMonth),
          totalRemaining: b.prepaidCalls + b.rolloverCalls + Math.max(0, b.callsLimit - b.callsThisMonth),
        })),
        totalPrepaidAcrossBrokers: brokers.reduce((s, b) => s + b.prepaidCalls, 0),
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || "Failed to fetch brokers" });
    }
  });
}

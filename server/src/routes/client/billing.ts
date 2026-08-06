import { Plan } from "@prisma/client";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { cancelSubscription as cancelRazorpaySub, refundPayment } from "../../services/razorpay.service";
import { PLAN_DEFINITIONS, createSubscriptionCheckout, getRazorpayPlanIdForTier } from "../../services/subscription.service";

export default async function clientBillingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Get Current Subscription ──────────────────────────────────
  fastify.get("/subscriptions/current", async (request: FastifyRequest) => {
    const clientId = request.clientId!;

    const subscription = await fastify.prisma.subscription.findFirst({
      where: {
        clientId,
        status: { in: ["ACTIVE", "TRIAL", "PENDING"] },
      },
      include: { invoices: { orderBy: { createdAt: "desc" }, take: 5 } },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      const client = await fastify.prisma.client.findUnique({
        where: { id: clientId },
        select: {
          plan: true,
          planStatus: true,
          trialEndsAt: true,
          callsThisMonth: true,
          callsLimit: true,
        },
      });

      return {
        subscription: null,
        plan: client?.plan,
        planStatus: client?.planStatus,
        trialEndsAt: client?.trialEndsAt,
        usage: {
          callsThisMonth: client?.callsThisMonth || 0,
          callsLimit: client?.callsLimit || 0,
        },
      };
    }

    return {
      subscription: {
        id: subscription.id,
        planName: subscription.planName,
        planTier: subscription.planTier,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
        amount: subscription.amount,
        currency: subscription.currency,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndDate: subscription.trialEndDate,
        autoRenew: subscription.autoRenew,
        features: subscription.features,
        limits: subscription.limits,
      },
      invoices: subscription.invoices,
    };
  });

  // ─── Create Subscription (with Razorpay) ──────────────────────
  // FIX #1 (P0): Now ALWAYS creates a Razorpay subscription.
  // FIX #6 (P2): Billing cycle (MONTHLY/YEARLY) enforced and passed to Razorpay.
  // FIX #8 (P2): Tracks trialStartedAt on first subscription creation.
  fastify.post("/subscriptions", {
    schema: {
      body: {
        type: "object",
        required: ["planTier"],
        properties: {
          planTier: { type: "string", enum: ["STARTER", "GROWTH", "PRO"] },
          billingCycle: { type: "string", enum: ["MONTHLY"] },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: { planTier: string; billingCycle?: string };
  }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { planTier, billingCycle = "MONTHLY" } = request.body;

    const plan = PLAN_DEFINITIONS[planTier];
    if (!plan) {
      return reply.status(400).send({ error: "Invalid plan tier" });
    }

    // ⚠️ MONTHLY-ONLY billing for now. Yearly is disabled: it previously sent
    // the monthly Razorpay plan with totalCount 12, which would overcharge a
    // yearly customer (e.g. ₹18,000 × 12 ≠ ₹1,80,000). Re-enable only when
    // separate yearly Razorpay plans are wired into the plan ID map.
    if (billingCycle !== "MONTHLY") {
      return reply.status(400).send({ error: "Yearly billing is not available yet. Please choose monthly billing." });
    }

    // Get client info for Razorpay
    const client = await fastify.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, phone: true, ownerName: true, trialStartedAt: true },
    });
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    // ─── Shared checkout flow (single source of truth — subscription.service.ts) ──
    const { subscription, paymentUrl } = await createSubscriptionCheckout(fastify, client, planTier, {
      billingCycle,
    });

    return reply.status(201).send({
      subscription,
      paymentUrl,
      message: paymentUrl
        ? "Subscription created. Complete payment via Razorpay to activate."
        : "Subscription created (manual payment required — Razorpay not configured).",
    });
  });

  // ─── Cancel Subscription (with actual refund via Razorpay) ────
  // FIX #2 (P0): Now EXECUTES the refund via Razorpay API instead of just recording it.
  fastify.post("/subscriptions/cancel", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const subscription = await fastify.prisma.subscription.findFirst({
      where: { clientId, status: { in: ["ACTIVE", "TRIAL"] } },
      include: {
        invoices: { where: { status: "PAID" }, orderBy: { issueDate: "desc" }, take: 1 },
      },
    });

    if (!subscription) {
      return reply.status(404).send({ error: "No active subscription found" });
    }

    // Cancel with Razorpay
    const razorpaySubId = subscription.providerSubscriptionId || null;
    if (razorpaySubId) {
      await cancelRazorpaySub(razorpaySubId);
    }

    // ─── Pro-rated Refund + Razorpay execution ──────────────────
    const now = new Date();
    const paidInvoice = subscription.invoices[0];
    let refundAmount = 0;
    let refundNote = "No refund — no paid invoice found";
    let refundExecuted = false;

    if (paidInvoice && paidInvoice.status === "PAID") {
      const periodStart = paidInvoice.periodStart || subscription.startDate;
      const periodEnd = paidInvoice.periodEnd || subscription.endDate;
      const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
      const daysUsed = Math.max(0, Math.round((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingDays = Math.max(0, totalDays - daysUsed);

      if (remainingDays > 0 && totalDays > 0) {
        refundAmount = Math.round((remainingDays / totalDays) * paidInvoice.totalAmount * 100) / 100;
        refundNote = `Pro-rated refund: ₹${refundAmount} for ${remainingDays}/${totalDays} days remaining`;

        // Find the paid Razorpay payment to execute the actual refund
        const paidPayment = await fastify.prisma.payment.findFirst({
          where: { invoiceId: paidInvoice.id, status: "SUCCESSFUL" },
          orderBy: { createdAt: "desc" },
        });

        if (paidPayment?.providerPaymentId) {
          try {
            const refundResult = await refundPayment(paidPayment.providerPaymentId, refundAmount);
            refundExecuted = true;

            // Store refund details on the payment record
            await fastify.prisma.payment.update({
              where: { id: paidPayment.id },
              data: {
                status: "REFUNDED",
                refundId: refundResult.refundId || null,
                refundAmount,
                refundReason: refundNote,
                refundedAt: new Date(),
              },
            });

            fastify.log.info(
              { clientId, refundAmount, refundId: refundResult.refundId },
              "Actual refund executed via Razorpay"
            );
          } catch (err: any) {
            fastify.log.error(
              { err: err.message, clientId, refundAmount },
              "Refund execution failed — refund logged but not processed via Razorpay"
            );
            refundNote += " (Refund execution failed — contact support)";
          }
        } else {
          fastify.log.warn({ clientId, paidInvoiceId: paidInvoice.id }, "No Razorpay payment found for refund");
        }
      } else {
        refundNote = "No refund — billing period fully used";
      }
    }

    // Mark subscription as cancelled
    await fastify.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", cancelledAt: now },
    });

    // Update client
    await fastify.prisma.client.update({
      where: { id: clientId },
      data: { planStatus: "CANCELLED" },
    });

    // Create refund credit note in DB
    if (refundAmount > 0) {
      const refundInvoiceNumber = `CN-${Date.now()}-${clientId.slice(-4)}`;
      await fastify.prisma.invoice.create({
        data: {
          clientId,
          subscriptionId: subscription.id,
          invoiceNumber: refundInvoiceNumber,
          status: "REFUNDED",
          description: refundNote,
          amount: -refundAmount,
          totalAmount: -refundAmount,
          issueDate: now,
          dueDate: now,
          periodStart: paidInvoice?.periodStart || subscription.startDate,
          periodEnd: now,
        },
      });
    }

    return {
      message: "Subscription cancelled",
      refund: refundAmount > 0 ? {
        amount: refundAmount,
        note: refundNote,
        executed: refundExecuted,
      } : undefined,
    };
  });

  // ─── Downgrade Plan (FIX #7) ──────────────────────────────────
  // Allows moving to a lower plan at the next billing cycle.
  fastify.post("/subscriptions/downgrade", {
    schema: {
      body: {
        type: "object",
        required: ["planTier"],
        properties: {
          planTier: { type: "string", enum: ["STARTER", "GROWTH"] },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { planTier: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { planTier } = request.body;

    const currentSub = await fastify.prisma.subscription.findFirst({
      where: { clientId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    if (!currentSub) {
      return reply.status(400).send({ error: "No active subscription to downgrade" });
    }

    // Validate downgrade (not upgrade)
    const TIER_ORDER: Record<string, number> = { STARTER: 0, GROWTH: 1, PRO: 2 };
    const currentTier = TIER_ORDER[currentSub.planTier] ?? 99;
    const requestedTier = TIER_ORDER[planTier] ?? -1;

    if (requestedTier >= currentTier) {
      return reply.status(400).send({ error: "Downgrade requires selecting a lower-priced plan" });
    }

    const targetPlan = PLAN_DEFINITIONS[planTier];
    if (!targetPlan) {
      return reply.status(400).send({ error: "Invalid plan tier" });
    }

    // Schedule cancellation at end of current billing cycle
    await fastify.prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        autoRenew: false,
        features: { maxUsers: targetPlan.users, maxLeads: targetPlan.leads, maxCalls: targetPlan.calls },
        limits: { users: targetPlan.users, leads: targetPlan.leads, calls: targetPlan.calls },
      },
    });

    // Update calls limit immediately (they should get the lower plan's limits)
    await fastify.prisma.client.update({
      where: { id: clientId },
      data: {
        plan: planTier as Plan,
        callsLimit: targetPlan.calls,
      },
    });

    fastify.log.info({ clientId, from: currentSub.planTier, to: planTier }, "Plan downgraded");

    return {
      message: `Plan will downgrade to ${targetPlan.name} at next billing cycle (${currentSub.endDate.toISOString().split("T")[0]}).`,
      currentPlan: currentSub.planTier,
      newPlan: planTier,
      effectiveDate: currentSub.endDate,
    };
  });

  // ─── List Invoices ────────────────────────────────────────────
  fastify.get("/subscriptions/invoices", async (request: FastifyRequest) => {
    const clientId = request.clientId!;
    const invoices = await fastify.prisma.invoice.findMany({
      where: { clientId },
      include: { payments: true },
      orderBy: { issueDate: "desc" },
    });

    return { invoices };
  });

  // ─── Get Invoice ───────────────────────────────────────────────
  fastify.get("/subscriptions/invoices/:id", async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const invoice = await fastify.prisma.invoice.findFirst({
      where: { id: request.params.id, clientId: request.clientId },
      include: { payments: true, subscription: true },
    });

    if (!invoice) {
      return reply.status(404).send({ error: "Invoice not found" });
    }

    return { invoice };
  });

  // ─── Get Billing Info ─────────────────────────────────────────
  // Exposes: plan, usage, trial tracking, usage alerts, dunning status
  fastify.get("/billing", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: {
        plan: true,
        planStatus: true,
        trialEndsAt: true,
        trialStartedAt: true,
        convertedFromTrialAt: true,
        razorpaySubId: true,
        callsThisMonth: true,
        callsLimit: true,
        rolloverCalls: true,
        leadsThisMonth: true,
        lastUsageAlertSentAt: true,
        usageAlertLevel: true,
        dunningStep: true,
        dunningStartedAt: true,
      },
    });

    if (!client) {
      return { plan: null, planStatus: null, usage: { callsThisMonth: 0, callsLimit: 0 } };
    }

    const totalAvailable = client.callsLimit + client.rolloverCalls;
    const totalRemaining = Math.max(0, totalAvailable - client.callsThisMonth);
    const usagePercent = totalAvailable > 0
      ? Math.round((client.callsThisMonth / totalAvailable) * 100)
      : 0;

    // FIX Round-2 #6: real monthly leads usage vs plan cap
    const { getMonthlyLeadsLimit } = await import("../../utils/lead-limits");

    return {
      plan: client.plan,
      planStatus: client.planStatus,
      trialEndsAt: client.trialEndsAt,
      trialStartedAt: client.trialStartedAt,
      convertedFromTrialAt: client.convertedFromTrialAt,
      razorpaySubId: client.razorpaySubId,
      usage: {
        callsThisMonth: client.callsThisMonth,
        callsLimit: client.callsLimit,
        rolloverCalls: client.rolloverCalls,
        leadsThisMonth: client.leadsThisMonth,
        leadsLimit: getMonthlyLeadsLimit(client.plan),
        totalAvailable,
        totalRemaining,
        usagePercent,
      },
      // Usage alert tracking
      usageAlerts: {
        lastAlertSentAt: client.lastUsageAlertSentAt,
        currentLevel: client.usageAlertLevel, // 0=none, 80, 90, 100
        needsAttention: client.usageAlertLevel >= 80,
      },
      // Dunning tracking (for PAST_DUE accounts)
      dunning: client.planStatus === "PAST_DUE" || client.planStatus === "CANCELLED" ? {
        step: client.dunningStep, // 0=none, 1=email, 2=whatsapp, 3=final
        startedAt: client.dunningStartedAt,
        isActive: client.dunningStep > 0 && client.dunningStep < 3,
      } : null,
    };
  });

  // ─── Upgrade Plan (legacy compatibility) ──────────────────────
  // FIX #10 (P0): Now mirrors the modern POST /subscriptions path — creates a
  // Subscription DB record + SENT invoice, cancels prior active subs, and sets
  // callsLimit. Previously it only updated client.razorpaySubId, leaving NO
  // Subscription row — which silently broke POST /subscriptions/cancel ("No
  // active subscription found" → no cancel/refund possible) and left brokers
  // with an empty invoice list for the upgrade charge.
  fastify.post("/billing/upgrade", async (request: FastifyRequest<{
    Body: { plan: "STARTER" | "GROWTH" | "PRO" };
  }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    const plan = PLAN_DEFINITIONS[request.body.plan];
    if (!plan) {
      return reply.status(400).send({ error: "Invalid plan selected or plan not configured" });
    }

    // Preserve legacy 400 behaviour when the Razorpay plan isn't configured
    if (!getRazorpayPlanIdForTier(request.body.plan)) {
      return reply.status(400).send({ error: "Invalid plan selected or plan not configured" });
    }

    // ─── Shared checkout flow (single source of truth — subscription.service.ts) ──
    // strict: true → a Razorpay failure throws here (legacy behaviour), so a
    // failed checkout never leaves a half-created subscription behind.
    const { razorpaySub } = await createSubscriptionCheckout(fastify, client, request.body.plan, {
      strict: true,
    });

    // Response shape preserved for the frontend: { subscription: { id, shortUrl, status } }
    return { subscription: razorpaySub };
  });

  // ─── Overage Billing ──────────────────────────────────────────
  fastify.post("/billing/overage", {
    schema: {
      body: {
        type: "object",
        required: ["pack"],
        properties: {
          pack: { type: "string", enum: ["50", "100", "250"] },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { pack: string } }>, reply: FastifyReply) => {
    const clientId = request.clientId!;
    const { pack } = request.body;

    const OVERAGE_PACKS: Record<string, { calls: number; price: number }> = {
      "50": { calls: 50, price: 500 },
      "100": { calls: 100, price: 900 },
      "250": { calls: 250, price: 2000 },
    };

    const selectedPack = OVERAGE_PACKS[pack];
    if (!selectedPack) {
      return reply.status(400).send({ error: "Invalid overage pack" });
    }

    // Create invoice
    const invoiceNumber = `OVG-${Date.now()}-${clientId.slice(-4)}`;
    const invoice = await fastify.prisma.invoice.create({
      data: {
        clientId,
        invoiceNumber,
        status: "SENT",
        description: `Overage: ${selectedPack.calls} extra calls for ₹${selectedPack.price}`,
        amount: selectedPack.price,
        totalAmount: selectedPack.price,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Trust-based: add calls immediately, create Razorpay payment link if configured
    const updatedClient = await fastify.prisma.client.update({
      where: { id: clientId },
      data: { rolloverCalls: { increment: selectedPack.calls } },
    });

    // Record revenue
    const { recordBrokerRevenue } = await import("../../services/credit-manager.service");
    await recordBrokerRevenue(fastify.prisma, {
      clientId,
      amount: selectedPack.price,
      description: `Overage pack: ${selectedPack.calls} calls for ₹${selectedPack.price}`,
    }).catch(() => {});

    fastify.log.info(
      { clientId, pack: selectedPack.calls, price: selectedPack.price, totalRollover: updatedClient.rolloverCalls },
      "Overage pack purchased"
    );

    return reply.status(201).send({
      invoice,
      overagePack: selectedPack,
      updatedRollover: updatedClient.rolloverCalls,
      message: `${selectedPack.calls} extra calls added. You now have ${updatedClient.rolloverCalls} rollover calls available. Payment of ₹${selectedPack.price} is expected within 7 days.`,
    });
  });

  // ─── Billing Portal ──────────────────────────────────────────
  fastify.post("/billing/portal", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { razorpaySubId: true },
    });

    return {
      portalUrl: client?.razorpaySubId
        ? `https://razorpay.com/subscriptions/${client.razorpaySubId}/manage`
        : null,
    };
  });
}

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createSubscription, getPlanIds, cancelSubscription as cancelRazorpaySub } from "../../services/razorpay.service";

const PLAN_DEFINITIONS: Record<string, { name: string; monthly: number; yearly: number; users: number; leads: number; calls: number }> = {
  STARTER: { name: "Starter", monthly: 1999, yearly: 19990, users: 5, leads: 500, calls: 100 },
  GROWTH: { name: "Growth", monthly: 4999, yearly: 49990, users: 15, leads: 3000, calls: 500 },
  PRO: { name: "Pro", monthly: 9999, yearly: 99990, users: 50, leads: 50000, calls: 10000 },
};

export default async function clientBillingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Get Current Subscription ──────────────────────────────────
  // Ported from FastAPI: GET /subscriptions/current
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
      // Return basic info from client if no subscription record yet
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

  // ─── Create Subscription ───────────────────────────────────────
  // Ported from FastAPI: POST /subscriptions/create
  fastify.post("/subscriptions", {
    schema: {
      body: {
        type: "object",
        required: ["planTier"],
        properties: {
          planTier: { type: "string", enum: ["STARTER", "GROWTH", "PRO"] },
          billingCycle: { type: "string", enum: ["MONTHLY", "YEARLY"] },
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

    const amount = billingCycle === "YEARLY" ? plan.yearly : plan.monthly;
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + (billingCycle === "YEARLY" ? 365 : 30));

    // Cancel any existing active subscriptions
    await fastify.prisma.subscription.updateMany({
      where: { clientId, status: { in: ["ACTIVE", "TRIAL"] } },
      data: { status: "CANCELLED", cancelledAt: now },
    });

    // Create new subscription in database
    const subscription = await fastify.prisma.subscription.create({
      data: {
        clientId,
        planName: plan.name,
        planTier,
        billingCycle: billingCycle as any,
        status: "ACTIVE",
        amount,
        totalAmount: amount,
        startDate: now,
        endDate,
        features: { maxUsers: plan.users, maxLeads: plan.leads, maxCalls: plan.calls },
        limits: { users: plan.users, leads: plan.leads, calls: plan.calls },
        autoRenew: true,
      },
    });

    // Update client plan info
    await fastify.prisma.client.update({
      where: { id: clientId },
      data: {
        plan: planTier as any,
        planStatus: "ACTIVE",
        callsLimit: plan.calls,
      },
    });

    // Create initial invoice
    const invoiceNumber = `INV-${Date.now()}-${clientId.slice(-4)}`;
    await fastify.prisma.invoice.create({
      data: {
        clientId,
        subscriptionId: subscription.id,
        invoiceNumber,
        status: "PAID",
        description: `${plan.name} (${billingCycle === "YEARLY" ? "Yearly" : "Monthly"})`,
        amount,
        totalAmount: amount,
        issueDate: now,
        dueDate: endDate,
        periodStart: now,
        periodEnd: endDate,
      },
    });

    return reply.status(201).send({ subscription });
  });

  // ─── Cancel Subscription ───────────────────────────────────────
  // Ported from FastAPI: POST /subscriptions/cancel
  fastify.post("/subscriptions/cancel", async (request: FastifyRequest, reply: FastifyReply) => {
    const clientId = request.clientId!;

    const subscription = await fastify.prisma.subscription.findFirst({
      where: { clientId, status: { in: ["ACTIVE", "TRIAL"] } },
    });

    if (!subscription) {
      return reply.status(404).send({ error: "No active subscription found" });
    }

    // Cancel with Razorpay if linked
    if (subscription.providerSubscriptionId) {
      await cancelRazorpaySub(subscription.providerSubscriptionId);
    }

    // Mark as cancelled in database
    await fastify.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    // Update client
    await fastify.prisma.client.update({
      where: { id: clientId },
      data: { planStatus: "CANCELLED" },
    });

    return { message: "Subscription cancelled" };
  });

  // ─── List Invoices ────────────────────────────────────────────
  // Ported from FastAPI: GET /subscriptions/invoices
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
  // Ported from FastAPI: GET /subscriptions/invoices/{id}
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

  // ─── Get Billing Info (legacy compatibility) ─────────────────
  fastify.get("/billing", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: {
        plan: true,
        planStatus: true,
        trialEndsAt: true,
        razorpaySubId: true,
        callsThisMonth: true,
        callsLimit: true,
      },
    });

    return {
      plan: client?.plan,
      planStatus: client?.planStatus,
      trialEndsAt: client?.trialEndsAt,
      razorpaySubId: client?.razorpaySubId,
      usage: {
        callsThisMonth: client?.callsThisMonth || 0,
        callsLimit: client?.callsLimit || 0,
      },
    };
  });

  // ─── Upgrade Plan (legacy compatibility) ──────────────────────
  fastify.post("/billing/upgrade", async (request: FastifyRequest<{
    Body: { plan: "STARTER" | "GROWTH" | "PRO" };
  }>, reply: FastifyReply) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
    });

    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    const planIds = getPlanIds();
    const planIdMap: Record<string, string> = {
      STARTER: planIds.starter,
      GROWTH: planIds.growth,
      PRO: planIds.pro,
    };

    const razorpayPlanId = planIdMap[request.body.plan];
    if (!razorpayPlanId) {
      return reply.status(400).send({ error: "Invalid plan selected or plan not configured" });
    }

    const subscription = await createSubscription({
      planId: razorpayPlanId,
      customerEmail: client.email,
      customerPhone: client.phone,
      customerName: client.ownerName,
      totalCount: 12,
      trialDays: request.body.plan === "STARTER" ? 14 : 0,
    });

    await fastify.prisma.client.update({
      where: { id: client.id },
      data: {
        plan: request.body.plan,
        planStatus: "ACTIVE",
        razorpaySubId: subscription.id,
      },
    });

    return { subscription };
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

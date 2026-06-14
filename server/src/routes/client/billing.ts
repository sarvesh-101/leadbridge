import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createSubscription, getPlanIds } from "../../services/razorpay.service";

export default async function clientBillingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  // ─── Get Billing Info ─────────────────────────────────────────
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

    // Dummy invoice list for now
    const invoices = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
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
      invoices: [],
    };
  });

  // ─── Upgrade Plan ─────────────────────────────────────────────
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

  // ─── Billing Portal (redirect to Razorpay) ────────────────────
  fastify.post("/billing/portal", async (request: FastifyRequest) => {
    const client = await fastify.prisma.client.findUnique({
      where: { id: request.clientId },
      select: { razorpaySubId: true },
    });

    // In production, generate a Razorpay customer portal link
    return {
      portalUrl: client?.razorpaySubId
        ? `https://razorpay.com/subscriptions/${client.razorpaySubId}/manage`
        : null,
    };
  });
}

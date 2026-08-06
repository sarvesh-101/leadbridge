import { BillingCycle, Plan, PlanStatus, Subscription } from "@prisma/client";
import { FastifyInstance } from "fastify";
import {
  createSubscription,
  getPlanIds,
  cancelSubscription as cancelRazorpaySub,
} from "./razorpay.service";

/**
 * Shared subscription checkout — the SINGLE source of truth for creating a
 * subscription on BOTH checkout paths (modern POST /subscriptions and the
 * legacy POST /billing/upgrade).
 *
 * Why this exists: the two paths used to duplicate ~40 lines of logic and
 * drifted, which caused a real bug (the legacy path silently skipped creating
 * a Subscription DB record + invoice, breaking cancel/refund and the invoice
 * list). Every checkout behaviour change must now be made HERE, once.
 */

export interface PlanDefinition {
  name: string;
  monthly: number;
  yearly: number;
  users: number;
  leads: number;
  calls: number;
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  STARTER: { name: "Starter", monthly: 18000, yearly: 180000, users: 5, leads: 500, calls: 100 },
  GROWTH: { name: "Growth", monthly: 35000, yearly: 350000, users: 15, leads: 3000, calls: 500 },
  PRO: { name: "Pro", monthly: 60000, yearly: 600000, users: 50, leads: 50000, calls: 999999 },
};

/**
 * 1200 monthly cycles = 100 years = "renews until cancelled".
 * Razorpay rejects 0 ("The total count must be at least 1"); 1200 is the
 * documented maximum for monthly plans and matches the "Cancel anytime" story.
 */
export const RAZORPAY_TOTAL_COUNT = 1200;

/** Map a plan tier to its configured Razorpay plan ID (empty string if unset). */
export function getRazorpayPlanIdForTier(planTier: string): string {
  const planIds = getPlanIds();
  const planIdMap: Record<string, string> = {
    STARTER: planIds.starter,
    GROWTH: planIds.growth,
    PRO: planIds.pro,
  };
  return planIdMap[planTier] || "";
}

export interface CheckoutClient {
  id: string;
  email: string;
  phone: string;
  ownerName: string;
  trialStartedAt: Date | null;
}

export interface SubscriptionCheckoutResult {
  /** Raw Razorpay subscription object (null when Razorpay failed / not configured). */
  razorpaySub: { id: string; shortUrl: string; status: string } | null;
  /** The created Subscription DB record. */
  subscription: Subscription;
  /** The created SENT invoice for this cycle. */
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    amount: number;
  };
  /** Razorpay payment short URL (null when Razorpay unavailable). */
  paymentUrl: string | null;
}

/**
 * Run the full checkout flow: create the live Razorpay subscription, cancel
 * any prior subscriptions (DB rows AND their live Razorpay subs so the old
 * plan stops charging), create the Subscription DB record, update the client,
 * and create the initial SENT invoice.
 *
 * @param opts.strict — when true, a Razorpay failure THROWS (legacy path
 *   behaviour: no DB record is created, caller returns an error). When false,
 *   the checkout degrades gracefully (status PENDING, planStatus TRIAL).
 */
export async function createSubscriptionCheckout(
  fastify: FastifyInstance,
  client: CheckoutClient,
  planTier: string,
  opts: { billingCycle?: string; strict?: boolean } = {}
): Promise<SubscriptionCheckoutResult> {
  const plan = PLAN_DEFINITIONS[planTier];
  if (!plan) {
    throw new Error("Invalid plan tier");
  }

  const amount = plan.monthly;
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 30);

  // ─── Create the live Razorpay subscription FIRST ─────────────────
  let razorpaySub: { id: string; shortUrl: string; status: string } | null = null;
  const razorpayPlanId = getRazorpayPlanIdForTier(planTier);
  if (razorpayPlanId) {
    try {
      razorpaySub = await createSubscription({
        planId: razorpayPlanId,
        customerEmail: client.email,
        customerPhone: client.phone,
        customerName: client.ownerName,
        totalCount: RAZORPAY_TOTAL_COUNT,
        trialDays: planTier === "STARTER" ? 14 : 0,
      });
    } catch (err: any) {
      fastify.log.warn({ err: err.message, planTier }, "Razorpay subscription creation failed");
      if (opts.strict) {
        throw err;
      }
    }
  } else {
    fastify.log.warn({ planTier }, "No Razorpay plan ID configured — subscription will not be charged");
    if (opts.strict) {
      throw new Error("Invalid plan selected or plan not configured");
    }
  }

  // ─── Cancel existing active subscriptions ─────────────────────────
  // FIX #11: cancel the OLD LIVE Razorpay subscription too — previously both
  // paths only marked the old DB row CANCELLED, leaving the old plan actively
  // charging on Razorpay while the DB said cancelled.
  const priorSubs = await fastify.prisma.subscription.findMany({
    where: { clientId: client.id, status: { in: ["ACTIVE", "TRIAL"] } },
    select: { id: true, providerSubscriptionId: true },
  });

  if (priorSubs.length > 0) {
    for (const prior of priorSubs) {
      if (prior.providerSubscriptionId && prior.providerSubscriptionId !== razorpaySub?.id) {
        // cancelSubscription never throws (catches internally and logs)
        await cancelRazorpaySub(prior.providerSubscriptionId);
        fastify.log.info(
          { clientId: client.id, oldSubId: prior.providerSubscriptionId },
          "Previous live Razorpay subscription cancelled on new checkout"
        );
      }
    }

    await fastify.prisma.subscription.updateMany({
      where: { clientId: client.id, status: { in: ["ACTIVE", "TRIAL"] } },
      data: { status: "CANCELLED", cancelledAt: now },
    });
  }

  // ─── Create Subscription DB record ────────────────────────────────
  const subscription = await fastify.prisma.subscription.create({
    data: {
      clientId: client.id,
      planName: plan.name,
      planTier,
      billingCycle: (opts.billingCycle as BillingCycle) || BillingCycle.MONTHLY,
      status: razorpaySub ? "ACTIVE" : "PENDING",
      amount,
      totalAmount: amount,
      startDate: now,
      endDate,
      features: { maxUsers: plan.users, maxLeads: plan.leads, maxCalls: plan.calls },
      limits: { users: plan.users, leads: plan.leads, calls: plan.calls },
      autoRenew: true,
      providerSubscriptionId: razorpaySub?.id || null,
    },
  });

  // ─── Update client plan info ──────────────────────────────────────
  await fastify.prisma.client.update({
    where: { id: client.id },
    data: {
      plan: planTier as Plan,
      planStatus: razorpaySub ? PlanStatus.ACTIVE : PlanStatus.TRIAL,
      callsLimit: plan.calls,
      razorpaySubId: razorpaySub?.id || undefined,
      // Track trial start if this is the first sub
      trialStartedAt: client.trialStartedAt || now,
      // Track trial → paid conversion if they were on trial
      ...(planTier !== "STARTER" && client.trialStartedAt ? { convertedFromTrialAt: now } : {}),
    },
  });

  // ─── Create initial invoice as SENT ───────────────────────────────
  const invoiceNumber = `INV-${Date.now()}-${client.id.slice(-4)}`;
  const invoice = await fastify.prisma.invoice.create({
    data: {
      clientId: client.id,
      subscriptionId: subscription.id,
      invoiceNumber,
      status: "SENT",
      description: `${plan.name} (Monthly)`,
      amount,
      totalAmount: amount,
      issueDate: now,
      dueDate: endDate,
      periodStart: now,
      periodEnd: endDate,
    },
  });

  return {
    razorpaySub,
    subscription,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.amount,
    },
    paymentUrl: razorpaySub?.shortUrl || null,
  };
}

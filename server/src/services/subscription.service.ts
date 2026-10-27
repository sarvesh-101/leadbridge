import { BillingCycle, Plan, PlanStatus, Subscription } from "@prisma/client";
import { FastifyInstance } from "fastify";
import { config } from "../config";
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
  // LAUNCH = entry tier (2026-09-07). Closes the ₹18K → ₹0 cliff: at ₹160/call it is
  // deliberately the WORST per-call rate in the ladder — designed as a stepping stone
  // to GROWTH (₹70/call), never a destination. See docs/plan-margins.md § LAUNCH.
  LAUNCH: { name: "Launch", monthly: 7999, yearly: 79990, users: 2, leads: 200, calls: 50 },
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
    LAUNCH: planIds.launch,
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
  /** Current plan status — a client already on TRIAL stays TRIAL after checkout. */
  planStatus?: PlanStatus | null;
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
  /** Why Razorpay rejected the sub (null when fine) — shown in checkout banner. */
  razorpayError?: string | null;
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
  let razorpayError: string | null = null;
  const razorpayPlanId = getRazorpayPlanIdForTier(planTier);
  if (razorpayPlanId) {
    try {
      razorpaySub = await createSubscription({
        planId: razorpayPlanId,
        customerEmail: client.email,
        customerPhone: client.phone,
        customerName: client.ownerName,
        totalCount: RAZORPAY_TOTAL_COUNT,
        trialDays: planTier === "STARTER" ? config.TRIAL_DAYS : 0,
      });
    } catch (err: any) {
      fastify.log.warn({ err: err.message, planTier }, "Razorpay subscription creation failed");
      razorpayError = err.message;
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
    // P1 LOOP FIX: cancelSubscription reports success instead of swallowing
    // errors. A prior sub whose Razorpay cancel FAILED must stay ACTIVE in our
    // DB — marking it CANCELLED anyway is exactly the "DB says cancelled while
    // Razorpay keeps charging" bug. Cancelling them was also previously
    // impossible from the UI, since the cancel route only looks for ACTIVE/TRIAL.
    const failedPriorIds: string[] = [];
    for (const prior of priorSubs) {
      if (prior.providerSubscriptionId && prior.providerSubscriptionId !== razorpaySub?.id) {
        const cancelResult = await cancelRazorpaySub(prior.providerSubscriptionId);
        if (cancelResult.ok) {
          fastify.log.info(
            { clientId: client.id, oldSubId: prior.providerSubscriptionId },
            "Previous live Razorpay subscription cancelled on new checkout"
          );
        } else {
          failedPriorIds.push(prior.id);
          fastify.log.error(
            { clientId: client.id, oldSubId: prior.providerSubscriptionId, err: cancelResult.error },
            "Previous live Razorpay subscription could NOT be cancelled — keeping it ACTIVE locally"
          );
        }
      }
    }

    await fastify.prisma.subscription.updateMany({
      where: {
        clientId: client.id,
        status: { in: ["ACTIVE", "TRIAL"] },
        ...(failedPriorIds.length > 0 ? { id: { notIn: failedPriorIds } } : {}),
      },
      data: { status: "CANCELLED", cancelledAt: now },
    });
  }

  // A checkout only lands in TRIAL when the plan carries its own trial
  // (STARTER) or the client is ALREADY inside a trial. A paying client who
  // abandons an upgrade must not be pushed into the dunning chain — that ends
  // in account cleanup (agent deleted, number released) on day 7.
  const staysInTrial = planTier === "STARTER" || client.planStatus === PlanStatus.TRIAL;

  // ─── Create Subscription DB record + client update + invoice ───────
  // ALL THREE WRITES ARE ONE TRANSACTION. Previously each ran on its own, so a
  // failure part-way through (e.g. prod's `Plan` enum rejecting 'LAUNCH' at
  // client.update) left a half-created checkout behind: a PENDING Subscription
  // row with no invoice, piled up one per retry. If the DB write fails AFTER
  // Razorpay already created the mandate, that live subscription is cancelled
  // too — otherwise it stays authorized and can charge a card for a checkout
  // that never completed.
  const invoiceNumber = `INV-${Date.now()}-${client.id.slice(-4)}`;
  let subscription: Subscription;
  let invoice: { id: string; invoiceNumber: string; status: string; amount: number };

  try {
    ({ subscription, invoice } = await fastify.prisma.$transaction(async (tx) => {
      const createdSub = await tx.subscription.create({
        data: {
          clientId: client.id,
          planName: plan.name,
          planTier,
          billingCycle: (opts.billingCycle as BillingCycle) || BillingCycle.MONTHLY,
          // P0 LOOP FIX: the DB sub is PENDING (not ACTIVE) until the first real
          // charge — the Razorpay sub exists but is unauthenticated at this point.
          // TRIAL when a trial applies; otherwise PENDING until the
          // subscription.charged webhook confirms payment and flips it to ACTIVE.
          status: razorpaySub ? (staysInTrial ? "TRIAL" : "PENDING") : "PENDING",
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

      // ─── Update client plan info ──────────────────────────────────
      // P0 LOOP FIX: checkout must NOT grant ACTIVE access before payment.
      // Previously planStatus flipped to ACTIVE here, so a broker who abandoned the
      // Razorpay modal stayed ACTIVE forever (the call gate only allows TRIAL/ACTIVE
      // and dunning only starts from PAST_DUE) → unpaid free AI calls up to plan
      // limits. Now:
      //   • trial applies (STARTER, or already in a trial) → TRIAL — bounded by the
      //     50-call trial cap until the first subscription.charged webhook fires.
      //   • otherwise (no trial — the charge fires as soon as the mandate is
      //     authorized) → PAST_DUE: call-gated immediately; the unpaid-activation
      //     sweep cron and the subscription.pending/halted webhooks back this up,
      //     and any subscription.charged webhook flips it to ACTIVE when they pay.
      // The trial→paid conversion stamp (convertedFromTrialAt) moved to the
      // subscription.charged first-payment branch in the Razorpay webhook — it
      // previously stamped HERE (at click time, before payment), which broke that
      // webhook's newPayers first-charge detection.
      await tx.client.update({
        where: { id: client.id },
        data: {
          plan: planTier as Plan,
          planStatus: razorpaySub && !staysInTrial ? PlanStatus.PAST_DUE : PlanStatus.TRIAL,
          callsLimit: plan.calls,
          razorpaySubId: razorpaySub?.id || undefined,
          // Track trial start if this is the first sub
          trialStartedAt: client.trialStartedAt || now,
        },
      });

      // ─── Create initial invoice as SENT ─────────────────────────────
      const createdInvoice = await tx.invoice.create({
        data: {
          clientId: client.id,
          subscriptionId: createdSub.id,
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
        subscription: createdSub,
        invoice: {
          id: createdInvoice.id,
          invoiceNumber: createdInvoice.invoiceNumber,
          status: createdInvoice.status,
          amount: createdInvoice.amount,
        },
      };
    }));
  } catch (err: any) {
    fastify.log.error(
      { clientId: client.id, planTier, razorpaySubId: razorpaySub?.id, err: err.message },
      "Checkout DB write failed — rolled back"
    );
    if (razorpaySub) {
      const rollback = await cancelRazorpaySub(razorpaySub.id);
      fastify.log[rollback.ok ? "warn" : "error"](
        { clientId: client.id, razorpaySubId: razorpaySub.id, rollbackOk: rollback.ok },
        rollback.ok
          ? "Orphan live Razorpay subscription cancelled after failed checkout"
          : "Could NOT cancel orphan Razorpay subscription — cancel it manually in the dashboard"
      );
    }
    throw err;
  }

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
    // Real Razorpay rejection reason (null when all good) — checkout surfaces it
    // in the banner so mode/config mismatches are diagnosable without log dives.
    razorpayError,
  };
}

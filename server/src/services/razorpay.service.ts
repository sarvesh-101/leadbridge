import axios from "axios";
import crypto from "crypto";
import { config } from "../config";
import { logger } from "../utils/logger";

/**
 * Razorpay service — subscriptions, payments, and billing management.
 */

const razorpayApi = axios.create({
  baseURL: "https://api.razorpay.com/v1",
  auth: {
    username: config.RAZORPAY_KEY_ID || "",
    password: config.RAZORPAY_KEY_SECRET || "",
  },
  timeout: 15000,
});

export interface PlanDetails {
  launch: string;
  starter: string;
  growth: string;
  pro: string;
}

export function getPlanIds(): PlanDetails {
  return {
    launch: config.RAZORPAY_PLAN_LAUNCH || "",
    starter: config.RAZORPAY_PLAN_STARTER || "",
    growth: config.RAZORPAY_PLAN_GROWTH || "",
    pro: config.RAZORPAY_PLAN_PRO || "",
  };
}

/**
 * Create a subscription for a client.
 */
export async function createSubscription(params: {
  planId: string;
  customerId?: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  totalCount: number;
  trialDays?: number;
}): Promise<{ id: string; shortUrl: string; status: string }> {
  try {
    // Plans created in the dashboard may carry their OWN trial period. Razorpay
    // rejects a subscription that sends start_at (or trial_period_days) against
    // such a plan: "trial_period_days is/are not required and should not be
    // sent" (hit live 2026-09-29). Read the plan first and shape the payload
    // accordingly — works for both clean and trial-configured plans.
    let planTrialDays = 0;
    try {
      const planResp = await razorpayApi.get(`/plans/${params.planId}`);
      planTrialDays = Number(planResp.data?.item?.trial_period_days ?? planResp.data?.trial_period_days ?? 0) || 0;
    } catch {
      // Plan lookup is best-effort; default to no-plan-trial behaviour.
    }
    const planHasTrial = planTrialDays > 0;

    // Razorpay's POST /subscriptions has NO `trial_period_days` parameter — the
    // documented request body is plan_id, total_count, quantity, customer_notify,
    // start_at, expire_by, addons, notes, offer_id. The only supported way to give
    // a free trial is a FUTURE start_at (docs "Create Subscriptions": "you can add
    // a trial period by passing a future start date in the start-at parameter").
    //
    // Sending trial_period_days is what broke every STARTER checkout: STARTER is
    // the only tier that requests a trial (trialDays = TRIAL_DAYS), so it was the
    // only tier Razorpay rejected — the checkout then degraded to "payment
    // required manually" while GROWTH/PRO/LAUNCH (trialDays 0) went through.
    //
    // A plan that carries its OWN trial already defers the first charge, and
    // start_at is invalid alongside it, so we omit start_at in that case.
    const startAt = planHasTrial
      ? null
      : Math.floor(Date.now() / 1000) +
        (params.trialDays && params.trialDays > 0 ? params.trialDays * 86400 : 0);

    const response = await razorpayApi.post("/subscriptions", {
      plan_id: params.planId,
      customer_notify: 1,
      total_count: params.totalCount,
      ...(startAt !== null ? { start_at: startAt } : {}),
      notes: {
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
        customer_name: params.customerName,
      },
    });

    logger.info({ subscriptionId: response.data.id }, "Razorpay subscription created");

    return {
      id: response.data.id,
      shortUrl: response.data.short_url,
      status: response.data.status,
    };
  } catch (error: any) {
    const description = error.response?.data?.error?.description || error.message;
    logger.error({ err: description }, "Razorpay subscription failed");
    // Surface the REAL Razorpay reason (invalid plan id, mode mismatch, auth…)
    // instead of a generic string — this is what the checkout banner shows.
    throw new Error(`Failed to create subscription: ${description}`);
  }
}

/**
 * Cancel a subscription.
 *
 * P1 LOOP FIX: previously ALL Razorpay errors were swallowed (caught → log),
 * so the caller never knew the cancellation silently failed: our DB said
 * CANCELLED while Razorpay kept charging the broker. The function now reports
 * success explicitly (still never throws, so the checkout path that treats it
 * as best-effort keeps working); the cancel/refund route in billing.ts acts
 * on the result.
 */
export async function cancelSubscription(
  subscriptionId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await razorpayApi.post(`/subscriptions/${subscriptionId}/cancel`, {
      cancel_at_cycle_end: 0,
    });
    logger.info({ subscriptionId }, "Razorpay subscription cancelled");
    return { ok: true };
  } catch (error: any) {
    logger.error({ subscriptionId, err: error.message }, "Failed to cancel subscription");
    return { ok: false, error: error.response?.data?.error?.description || error.message };
  }
}

/**
 * Execute an actual refund via Razorpay for a payment.
 * FIX #2 (P0): Called from cancellation flow to return money to the broker.
 */
export async function refundPayment(
  paymentId: string,
  amount: number
): Promise<{ refundId: string; status: string }> {
  try {
    const response = await razorpayApi.post(`/payments/${paymentId}/refund`, {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
    });

    logger.info({ paymentId, refundId: response.data.id, amount }, "Refund executed via Razorpay");

    return {
      refundId: response.data.id,
      status: response.data.status,
    };
  } catch (error: any) {
    logger.error(
      { paymentId, amount, err: error.response?.data?.error?.description || error.message },
      "Razorpay refund failed"
    );
    throw new Error(`Failed to execute refund: ${error.response?.data?.error?.description || error.message}`);
  }
}

/**
 * Verify Razorpay webhook signature.
 * Safe-guarded: returns false (never throws) when the secret is missing or the
 * signature is empty/malformed, so an unconfigured webhook can't crash the route.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = config.RAZORPAY_WEBHOOK_SECRET || "";
  if (!secret || !signature) {
    logger.warn({ hasSecret: !!secret, hasSignature: !!signature }, "Razorpay webhook signature check skipped — secret or signature missing");
    return false;
  }

  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);

    // timingSafeEqual throws on length mismatch — return false instead of crashing
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  } catch (err: any) {
    logger.error({ err: err.message }, "Razorpay webhook signature verification error");
    return false;
  }
}

/**
 * Fetch invoice details.
 */
export async function getInvoice(invoiceId: string) {
  try {
    const response = await razorpayApi.get(`/invoices/${invoiceId}`);
    return response.data;
  } catch {
    return null;
  }
}

/**
 * P1 LOOP FIX (refund fallback): find the latest captured payment for a Razorpay
 * subscription via the API. Used by the cancel/refund route when the DB Payment
 * row has no providerPaymentId yet — e.g. the broker pays and cancels within
 * seconds and the subscription.charged webhook (which records the Payment) is
 * still in flight. Without this the refund is "logged but never executed".
 * Returns just the Razorpay payment id (never raw credentials), or null.
 */
export async function getLatestCapturedSubscriptionPayment(
  subscriptionId: string
): Promise<string | null> {
  try {
    const response = await razorpayApi.get("/payments", {
      params: { subscription_id: subscriptionId, count: 10 },
    });
    const payments = (response.data?.items || []) as Array<{
      id: string;
      status: string;
      created_at: number;
    }>;
    const captured = payments
      .filter((p) => p.status === "captured")
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return captured[0]?.id || null;
  } catch (error: any) {
    logger.warn(
      { subscriptionId, err: error.message },
      "Could not fetch subscription payments from Razorpay for refund fallback"
    );
    return null;
  }
}

/**
 * Probe: does the configured key pair actually authenticate against the
 * Razorpay API? Returns the key-id PREFIX only (never the secret) so ops can
 * verify which credential the running instance holds. GET /health/razorpay.
 */
export async function verifyRazorpayAuth(): Promise<{
  ok: boolean;
  httpStatus?: number;
  error?: string;
  keyIdPrefix: string;
}> {
  const keyIdPrefix = (config.RAZORPAY_KEY_ID || "").slice(0, 14);
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    return { ok: false, error: "KEY_ID or KEY_SECRET not set", keyIdPrefix };
  }
  try {
    await razorpayApi.get("/plans?count=1");
    return { ok: true, keyIdPrefix };
  } catch (error: any) {
    return {
      ok: false,
      httpStatus: error.response?.status,
      error: error.response?.data?.error?.description || error.message,
      keyIdPrefix,
    };
  }
}

/**
 * Signature for the embedded Razorpay Checkout modal (subscription mode).
 * Checkout.js requires HMAC-SHA256(subscription_id, key_secret) as
 `subscription: { handler }` validation — without it the modal errors with
 * "signature validation failed". Same secret as webhooks (key_secret), but a
 * different algorithm: raw subscription_id, no payload body.
 */
export function generateSubscriptionOrderSignature(subscriptionId: string): string {
  return crypto
    .createHmac("sha256", config.RAZORPAY_KEY_SECRET || "")
    .update(subscriptionId)
    .digest("hex");
}

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
  starter: string;
  growth: string;
  pro: string;
}

export function getPlanIds(): PlanDetails {
  return {
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
    const response = await razorpayApi.post("/subscriptions", {
      plan_id: params.planId,
      customer_notify: 1,
      total_count: params.totalCount,
      // REQUIRED — without start_at Razorpay returns a generic "Validation failed"
      // (verified live on 2026-08-04: every payload variant 400'd until start_at added).
      // start_at = now → the subscription begins immediately (trial_period_days still
      // applies on top for the STARTER trial).
      start_at: Math.floor(Date.now() / 1000),
      ...(params.trialDays ? { trial_period_days: params.trialDays } : {}),
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
    logger.error({ err: error.response?.data?.error?.description || error.message }, "Razorpay subscription failed");
    throw new Error("Failed to create subscription");
  }
}

/**
 * Cancel a subscription.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  try {
    await razorpayApi.post(`/subscriptions/${subscriptionId}/cancel`, {
      cancel_at_cycle_end: 0,
    });
    logger.info({ subscriptionId }, "Razorpay subscription cancelled");
  } catch (error: any) {
    logger.error({ subscriptionId, err: error.message }, "Failed to cancel subscription");
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

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
 * Verify Razorpay webhook signature.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", config.RAZORPAY_WEBHOOK_SECRET || "")
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
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

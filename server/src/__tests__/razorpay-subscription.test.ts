import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the POST /subscriptions payload.
 *
 * Why these exist: STARTER checkout failed while GROWTH/PRO succeeded. STARTER
 * is the only tier that requests a trial, and `createSubscription` sent Razorpay
 * a `trial_period_days` parameter — which is NOT part of POST /subscriptions.
 * Razorpay's documented way to give a trial is a FUTURE `start_at`, so these
 * tests pin that behaviour for every tier.
 */

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("axios", () => ({
  default: { create: () => ({ get: getMock, post: postMock }) },
}));

import { createSubscription } from "../services/razorpay.service";

const base = {
  planId: "plan_x",
  customerEmail: "broker@test.com",
  customerPhone: "+919000000000",
  customerName: "Test Broker",
  totalCount: 1200,
};

/** The body handed to razorpayApi.post("/subscriptions", …) */
function sentBody() {
  expect(postMock).toHaveBeenCalledTimes(1);
  const [path, body] = postMock.mock.calls[0];
  expect(path).toBe("/subscriptions");
  return body as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  postMock.mockResolvedValue({
    data: { id: "sub_live_1", short_url: "https://rzp.io/test", status: "created" },
  });
});

describe("createSubscription — trial handling", () => {
  it("expresses a requested trial as a FUTURE start_at and never as trial_period_days (STARTER)", async () => {
    // STARTER's Razorpay plan carries no plan-level trial, so the trial must come
    // from start_at. This is the exact case that used to be rejected.
    getMock.mockResolvedValue({ data: { item: { trial_period_days: 0 } } });

    const before = Math.floor(Date.now() / 1000);
    await createSubscription({ ...base, trialDays: 30 });

    const body = sentBody();
    expect(body.trial_period_days).toBeUndefined();
    expect(body.start_at).toBeGreaterThanOrEqual(before + 30 * 86400 + 10);
    expect(body.start_at).toBeLessThanOrEqual(before + 30 * 86400 + 15);
  });

  it("starts immediately when no trial is requested (GROWTH / PRO / LAUNCH)", async () => {
    getMock.mockResolvedValue({ data: { item: { trial_period_days: 0 } } });

    const before = Math.floor(Date.now() / 1000);
    await createSubscription({ ...base, trialDays: 0 });

    const body = sentBody();
    expect(body.trial_period_days).toBeUndefined();
    // start_at must be strictly in the future or Razorpay rejects it; this is the
    // fix for the Launch route "start_at cannot be lesser than the current time".
    expect(body.start_at).toBeGreaterThanOrEqual(before + 10);
    expect(body.start_at).toBeLessThanOrEqual(before + 15);
  });

  it("omits start_at entirely for a plan that carries its own trial", async () => {
    getMock.mockResolvedValue({ data: { item: { trial_period_days: 30 } } });

    await createSubscription({ ...base, trialDays: 30 });

    const body = sentBody();
    expect(body.start_at).toBeUndefined();
    expect(body.trial_period_days).toBeUndefined();
  });

  it("reads a top-level plan trial_period_days too (Razorpay returns it on either level)", async () => {
    getMock.mockResolvedValue({ data: { trial_period_days: 30 } });

    await createSubscription({ ...base, trialDays: 30 });

    expect(sentBody().start_at).toBeUndefined();
  });

  it("still starts immediately when the plan lookup fails", async () => {
    getMock.mockRejectedValue(new Error("network"));

    const before = Math.floor(Date.now() / 1000);
    await createSubscription({ ...base, trialDays: 0 });

    const body = sentBody();
    expect(body.trial_period_days).toBeUndefined();
    expect(body.start_at).toBeGreaterThanOrEqual(before + 10);
    expect(body.start_at).toBeLessThanOrEqual(before + 15);
  });

  it("always sends the plan id, cycle count and customer notes", async () => {
    getMock.mockResolvedValue({ data: { item: {} } });

    await createSubscription({ ...base, trialDays: 0 });

    expect(sentBody()).toMatchObject({
      plan_id: base.planId,
      total_count: 1200,
      customer_notify: 1,
      notes: {
        customer_email: base.customerEmail,
        customer_phone: base.customerPhone,
        customer_name: base.customerName,
      },
    });
  });
});

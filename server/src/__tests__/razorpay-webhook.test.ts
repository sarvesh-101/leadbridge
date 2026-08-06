import { describe, it, expect } from "vitest";
import { verifyWebhookSignature } from "../services/razorpay.service";

/**
 * These tests verify the crash-guard behavior of verifyWebhookSignature.
 * RAZORPAY_WEBHOOK_SECRET is NOT set in the vitest env, so the function must
 * return false (never throw) — which is exactly the production state today.
 */
describe("Razorpay webhook signature verification", () => {
  it("returns false (does NOT throw) when the webhook secret is not configured", () => {
    const payload = JSON.stringify({ event: "subscription.charged" });
    const signature = "some-signature";
    expect(() => verifyWebhookSignature(payload, signature)).not.toThrow();
    expect(verifyWebhookSignature(payload, signature)).toBe(false);
  });

  it("returns false when the signature is empty", () => {
    const payload = JSON.stringify({ event: "payment.failed" });
    expect(verifyWebhookSignature(payload, "")).toBe(false);
    expect(verifyWebhookSignature(payload, undefined as unknown as string)).toBe(false);
  });

  it("returns false for a malformed signature instead of crashing (timingSafeEqual length guard)", () => {
    const payload = JSON.stringify({ event: "subscription.charged" });
    // Any non-empty garbage signature must be rejected safely
    const shortSig = "abc";
    const longSig = "x".repeat(128);
    expect(() => verifyWebhookSignature(payload, shortSig)).not.toThrow();
    expect(verifyWebhookSignature(payload, shortSig)).toBe(false);
    expect(() => verifyWebhookSignature(payload, longSig)).not.toThrow();
    expect(verifyWebhookSignature(payload, longSig)).toBe(false);
  });

  it("does not mutate state and is repeatable", () => {
    const payload = JSON.stringify({ event: "subscription.cancelled" });
    expect(verifyWebhookSignature(payload, "sig")).toBe(false);
    expect(verifyWebhookSignature(payload, "sig")).toBe(false);
  });
});

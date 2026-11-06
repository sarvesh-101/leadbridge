import { describe, it, expect, vi } from "vitest";
import crypto from "crypto";
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

/**
 * The route must hash the exact bytes Razorpay signed (request.rawBody), not a
 * re-serialized copy of the parsed body. JSON.stringify() loses key order,
 * whitespace and number formatting, so the old fallback only verified by luck.
 */
describe("Razorpay webhook raw-body verification", () => {
  it("accepts a signature computed over rawBody even when it differs from JSON.stringify(body)", async () => {
    vi.resetModules();
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "test_webhook_secret");

    const handlers: Record<string, (req: any, reply: any) => Promise<unknown>> = {};
    const fastify = {
      addHook: vi.fn(),
      post: vi.fn((path: string, _opts: unknown, handler: any) => {
        handlers[path] = handler;
      }),
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    };

    const mod = await import("../routes/webhooks/razorpay");
    await mod.default(fastify as never);

    // Whitespace + non-canonical formatting a compact re-serialization drops.
    const rawBody = '{ "event" : "test.unhandled",   "payload" : { "a" : 1 } }';
    const body = JSON.parse(rawBody);
    // Guard: the test is only meaningful if re-serializing would NOT match.
    expect(JSON.stringify(body)).not.toBe(rawBody);

    const signature = crypto
      .createHmac("sha256", "test_webhook_secret")
      .update(rawBody)
      .digest("hex");

    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    await handlers["/webhooks/razorpay"](
      { headers: { "x-razorpay-signature": signature }, rawBody, body },
      reply
    );

    expect(reply.status).not.toHaveBeenCalledWith(401);
    expect(reply.status).toHaveBeenCalledWith(200);

    vi.unstubAllEnvs();
  });
});

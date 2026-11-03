import { describe, it, expect, vi } from "vitest";

vi.mock("../config", () => ({
  config: {
    JWT_SECRET: "test-secret",
    DEMO_DAILY_CAP: 25,
    DEMO_CLIENT_ID: undefined,
    DEMO_OTP_REQUIRED: true,
    WHATSAPP_TOKEN: undefined,
    WHATSAPP_PHONE_ID: undefined,
  },
}));

import { isPlausiblePhone, normalizePhone, hashOtp } from "../routes/public-demo";

describe("V2 (T6) — public demo funnel validation", () => {
  it("normalizes and accepts plausible Indian mobile numbers", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
    expect(isPlausiblePhone("919876543210")).toBe(true);
    expect(isPlausiblePhone("9876543210")).toBe(true);
  });

  it("rejects implausible phones (length, landline prefixes, foreigners)", () => {
    expect(isPlausiblePhone(normalizePhone("+1234567890"))).toBe(false);
    expect(isPlausiblePhone(normalizePhone("02212345678"))).toBe(false);
    expect(isPlausiblePhone(normalizePhone("98765"))).toBe(false);
    expect(isPlausiblePhone(normalizePhone(""))).toBe(false);
  });

  it("hashes the OTP with the app secret (raw codes never stored)", () => {
    const h1 = hashOtp("123456");
    const h2 = hashOtp("123456");
    const h3 = hashOtp("654321");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});

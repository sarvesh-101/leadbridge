import { describe, it, expect } from "vitest";
import { computeMessageBirdSignature, validMessageBirdSignature } from "../utils/messagebird-signature";

const API_KEY = "bk_eu1_test_key_12345";
const BODY = "id=abc123&sender=919876543210&recipient=919999999999&body=Test+lead";

describe("computeMessageBirdSignature", () => {
  it("produces a stable base64 HMAC-SHA256", () => {
    const sig1 = computeMessageBirdSignature(BODY, API_KEY);
    const sig2 = computeMessageBirdSignature(BODY, API_KEY);
    expect(sig1).toBe(sig2);
    expect(sig1.length).toBeGreaterThan(20);
  });

  it("differs per body and per key", () => {
    expect(computeMessageBirdSignature(BODY, API_KEY)).not.toBe(
      computeMessageBirdSignature(BODY + "x", API_KEY)
    );
    expect(computeMessageBirdSignature(BODY, API_KEY)).not.toBe(
      computeMessageBirdSignature(BODY, "another-key")
    );
  });
});

describe("validMessageBirdSignature", () => {
  it("accepts a signature made with the API key", () => {
    const header = computeMessageBirdSignature(BODY, API_KEY);
    expect(validMessageBirdSignature(BODY, undefined, header, API_KEY)).toBe(true);
  });

  it("accepts a signature made with the query token", () => {
    const token = "webhook-token-abc";
    const header = computeMessageBirdSignature(BODY, token);
    expect(validMessageBirdSignature(BODY, token, header, API_KEY)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const header = computeMessageBirdSignature(BODY, "attacker-key");
    expect(validMessageBirdSignature(BODY, undefined, header, API_KEY)).toBe(false);
  });

  it("rejects a missing header or missing API key", () => {
    expect(validMessageBirdSignature(BODY, undefined, undefined, API_KEY)).toBe(false);
    expect(validMessageBirdSignature(BODY, undefined, "abc", undefined)).toBe(false);
  });
});
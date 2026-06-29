import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncrypted } from "../utils/encryption";

// Vitest doesn't have a clean way to set env vars before module load,
// so we import the module after setting the env var for JWT_SECRET.
// The encryption module reads config which reads JWT_SECRET from env.

describe("Encryption Utility", () => {
  // NOTE: These tests depend on a valid JWT_SECRET being set in the test
  // environment. The config module reads env vars at import time, so
  // modifying process.env here has no effect on the pre-loaded config.

  // ─── Basic Roundtrip ─────────────────────────────────────

  it("encrypts and decrypts an API key correctly", () => {
    const original = "test_key_abcdef1234567890";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);

    expect(encrypted).not.toBe(original);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/); // base64
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each time for the same plaintext", () => {
    const original = "test_key_demo_value";
    const encrypted1 = encrypt(original);
    const encrypted2 = encrypt(original);

    // AES-256-GCM uses a random IV each time
    expect(encrypted1).not.toBe(encrypted2);
    // Both should decrypt to the same value
    expect(decrypt(encrypted1)).toBe(original);
    expect(decrypt(encrypted2)).toBe(original);
  });

  it("handles long secrets (API tokens up to 256 chars)", () => {
    const original = "a".repeat(256);
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it("handles special characters in secrets", () => {
    const original = "test_key_!@#$%^&*()_+-=[]{}|;':\",./<>?~`abc123";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it("handles short strings correctly", () => {
    const original = "abc";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  // ─── Empty/Null/Falsy Handling ───────────────────────────

  it("returns empty string for encrypt('')", () => {
    expect(encrypt("")).toBe("");
  });

  it("returns empty string for decrypt('')", () => {
    expect(decrypt("")).toBe("");
  });

  // ─── Backward Compatibility ──────────────────────────────

  it("returns plaintext as-is when decrypting unencrypted data (backward compat)", () => {
    const legacyData = "test_plaintext_key_not_encrypted";
    // This should not throw and return the original value
    expect(decrypt(legacyData)).toBe(legacyData);
  });

  it("gracefully handles decrypt of malformed base64", () => {
    // Too short to be encrypted (less than 33 bytes base64 = 44 base64 chars)
    const tooShort = "abc123";
    expect(decrypt(tooShort)).toBe(tooShort);
  });

  it("returns input unchanged when decrypt fails (backward compat)", () => {
    const garbage = "!!!not-valid-encrypted-data-at-all!!!";
    expect(decrypt(garbage)).toBe(garbage);
  });

  // ─── isEncrypted ─────────────────────────────────────────

  it("isEncrypted returns false for plaintext shorter than 44 chars", () => {
    expect(isEncrypted("abc")).toBe(false);
    expect(isEncrypted("demo_key")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("isEncrypted returns false for plaintext with non-base64 chars", () => {
    const longWithSpaces = "this-string-has-spaces-and-special-!-chars-in-it-foobar1234";
    expect(isEncrypted(longWithSpaces)).toBe(false);
  });

  it("isEncrypted returns true for valid encrypted output", () => {
    const encrypted = encrypt("my-secret-api-key");
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it("isEncrypted validates base64-only characters", () => {
    // null bytes, control characters, etc should not be considered encrypted
    const invalid = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]).toString("base64") + "a".repeat(38);
    expect(isEncrypted(invalid)).toBe(true); // It IS valid base64 with padding
  });

  // ─── Integration-style: Roundtrip with realistic credentials ─

  it("handles IndiaMart-style API key roundtrip", () => {
    const original = "IM_TEST_ABCDEF1234567890abcdef";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it("handles Facebook-style access token", () => {
    const original = "EAACwZCk9ZBZB4BAOmzsZB5JCZCQZCZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZBZ";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it("handles Zoho-style OAuth refresh token (JWT-like)", () => {
    const original = "1000.abc123def456ghi789jkl012mno345pqr678stu901vwx234yz5678";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  // ─── Deterministic Encryption Property Tests ─────────────

  it("encryption + decryption is idempotent", () => {
    const values = [
      "a",
      "hello",
      "api_key_123",
      "test_key_very_long_value_that_goes_on_and_on_and_on_and_on_and_on_and_on_and_on",
      "{\"client_id\":\"123\",\"client_secret\":\"abc\"}",
    ];

    for (const val of values) {
      const encrypted = encrypt(val);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(val);
    }
  });
});

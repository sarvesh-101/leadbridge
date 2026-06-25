/**
 * Credential Encryption Utility
 *
 * Encrypts/decrypts sensitive fields (API keys, secrets, tokens) at rest
 * using AES-256-GCM. The encryption key is derived from ENCRYPTION_KEY or
 * JWT_SECRET (SHA-256 hashed to get exactly 32 bytes).
 *
 * Usage:
 *   const encrypted = encrypt("sk-live-abc123");
 *   const decrypted = decrypt(encrypted); // "sk-live-abc123"
 */

import crypto from "node:crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Derive a 32-byte key from the configured encryption secret using SHA-256.
 * This ensures we always have exactly 32 bytes regardless of the input length.
 */
function deriveKey(): Buffer {
  const secret = config.ENCRYPTION_KEY || config.JWT_SECRET;
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing: iv + ciphertext + authTag.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;

  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  // Prepend IV and append auth tag
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([
    iv,
    Buffer.from(ciphertext, "base64"),
    authTag,
  ]);

  return combined.toString("base64");
}

/**
 * Decrypt an encrypted string produced by encrypt().
 * Returns the original plaintext, or the input unchanged if it's not
 * valid encrypted data.
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) return encrypted;

  try {
    const key = deriveKey();
    const combined = Buffer.from(encrypted, "base64");

    // Minimum length: IV (16) + min ciphertext (1) + tag (16) = 33 bytes
    if (combined.length < IV_LENGTH + TAG_LENGTH + 1) {
      // Not our encrypted format — assume already plaintext (backward compat)
      return encrypted;
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plain = decipher.update(ciphertext, undefined, "utf8");
    plain += decipher.final("utf8");

    return plain;
  } catch {
    // If decryption fails, return as-is for backward compatibility
    // (might be unencrypted data from before encryption was introduced)
    return encrypted;
  }
}

/**
 * Check if a string looks like it's already encrypted (base64-encoded
 * AES-256-GCM output is always > 44 chars and contains only base64 chars).
 * Used to avoid double-encryption.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 44) return false;
  return /^[A-Za-z0-9+/=]+$/.test(value);
}

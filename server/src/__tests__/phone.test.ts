import { describe, it, expect } from "vitest";
import { normalizePhone, maskPhone, isValidPhone } from "../utils/phone";

describe("Phone Number Utilities", () => {
  describe("normalizePhone", () => {
    it("normalizes a 10-digit number to +91 format", () => {
      expect(normalizePhone("9876543210")).toBe("+919876543210");
    });

    it("normalizes a number with +91 prefix", () => {
      expect(normalizePhone("+919876543210")).toBe("+919876543210");
    });

    it("normalizes a number with 91 prefix (12 digits)", () => {
      expect(normalizePhone("919876543210")).toBe("+919876543210");
    });

    it("normalizes a number with leading 0", () => {
      expect(normalizePhone("09876543210")).toBe("+919876543210");
    });

    it("strips spaces, dashes, and parentheses", () => {
      expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
      expect(normalizePhone("987-654-3210")).toBe("+919876543210");
    });

    it("throws for non-Indian starting digit", () => {
      expect(() => normalizePhone("1234567890")).toThrow("Invalid Indian mobile number");
    });

    it("throws for short numbers", () => {
      expect(() => normalizePhone("98765")).toThrow("Invalid phone number");
    });

    it("throws for empty input", () => {
      expect(() => normalizePhone("")).toThrow("Invalid phone number");
    });
  });

  describe("maskPhone", () => {
    it("masks all but last 4 digits", () => {
      expect(maskPhone("+919876543210")).toBe("+91 ••••• 3210");
    });

    it("masks a plain 10-digit number", () => {
      expect(maskPhone("9876543210")).toBe("+91 ••••• 3210");
    });

    it("returns input unchanged for short strings", () => {
      expect(maskPhone("123")).toBe("123");
    });
  });

  describe("isValidPhone", () => {
    it("returns true for valid Indian numbers", () => {
      expect(isValidPhone("9876543210")).toBe(true);
      expect(isValidPhone("+919876543210")).toBe(true);
    });

    it("returns false for invalid numbers", () => {
      expect(isValidPhone("1234567890")).toBe(false);
      expect(isValidPhone("9876")).toBe(false);
      expect(isValidPhone("")).toBe(false);
    });
  });
});

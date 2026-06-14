import { describe, it, expect } from "vitest";
import { parseLead, parseWithMapping } from "../utils/lead-parser";

describe("Lead Parser", () => {
  describe("parseLead", () => {
    it("parses a 99acres payload correctly", () => {
      const payload = {
        name: "Rahul Sharma",
        phone: "9876543210",
        email: "rahul@example.com",
        budget: "50L-1Cr",
        propertyType: "flat",
      };
      const result = parseLead("99acres", payload);
      expect(result.name).toBe("Rahul Sharma");
      expect(result.phone).toBe("+919876543210");
      expect(result.email).toBe("rahul@example.com");
      expect(result.source).toBe("99acres");
    });

    it("parses a MagicBricks payload correctly", () => {
      const payload = {
        Name: "Priya Patel",
        mobile: "9988776655",
        Email: "priya@test.com",
      };
      const result = parseLead("magicbricks", payload);
      expect(result.name).toBe("Priya Patel");
      expect(result.phone).toBe("+919988776655");
      expect(result.email).toBe("priya@test.com");
      expect(result.source).toBe("magicbricks");
    });

    it("parses a JustDial payload correctly", () => {
      const payload = {
        contact_person: "Amit Singh",
        PhoneNumber: "+91-9876543210",
        email_id: "amit@justdial.com",
      };
      const result = parseLead("justdial", payload);
      expect(result.name).toBe("Amit Singh");
      expect(result.phone).toBe("+919876543210");
      expect(result.email).toBe("amit@justdial.com");
      expect(result.source).toBe("justdial");
    });

    it("falls back to manual parser for unknown sources", () => {
      const payload = {
        name: "Test User",
        phone: "9876543210",
      };
      const result = parseLead("unknown-portal", payload);
      expect(result.name).toBe("Test User");
      expect(result.phone).toBe("+919876543210");
      expect(result.source).toBe("manual");
    });

    it("returns 'Unknown Lead' when no name is found", () => {
      const payload = { phone: "9876543210" };
      const result = parseLead("99acres", payload);
      expect(result.name).toBe("Unknown Lead");
    });

    it("handles missing phone number", () => {
      const payload = { name: "Test User" };
      const result = parseLead("manual", payload);
      expect(result.phone).toBe("");
    });

    it("cleans phone number with non-digit characters", () => {
      const payload = {
        name: "Test",
        phone: "+91 (987) 654-3210",
      };
      const result = parseLead("housing", payload);
      expect(result.phone).toBe("+919876543210");
    });

    it("handles 11-digit phone starting with 0", () => {
      const payload = {
        name: "Test",
        phone: "09876543210",
      };
      const result = parseLead("manual", payload);
      expect(result.phone).toBe("+919876543210");
    });
  });

  describe("parseWithMapping", () => {
    it("maps fields using custom mapping (returns raw values)", () => {
      const payload = {
        full_name: "Raj Kumar",
        mobile_number: "9876543210",
        email_address: "raj@example.com",
      };
      const mapping = {
        name: "full_name",
        phone: "mobile_number",
        email: "email_address",
      };
      const result = parseWithMapping(payload, mapping);
      expect(result.name).toBe("Raj Kumar");
      // parseWithMapping returns the raw mapped value without normalization
      expect(result.phone).toBe("9876543210");
      expect(result.email).toBe("raj@example.com");
      expect(result.source).toBe("custom");
    });

    it("falls back to auto-detection for unmapped fields", () => {
      const payload = {
        name: "Direct Name",
        phone: "9876543210",
      };
      const result = parseWithMapping(payload, {});
      expect(result.name).toBe("Direct Name");
      // Falls back to extractPhone which normalizes
      expect(result.phone).toBe("+919876543210");
    });

    it("handles empty payload gracefully", () => {
      const result = parseWithMapping({}, { name: "full_name" });
      expect(result.name).toBe("Unknown Lead");
    });
  });
});

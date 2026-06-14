import { describe, it, expect } from "vitest";
import {
  canTransition,
  getValidTransitions,
  isTerminal,
  isCallable,
  isBookable,
  isInFollowup,
  validateTransition,
} from "../utils/lifecycle";

describe("Lead Lifecycle State Machine", () => {
  describe("canTransition", () => {
    it("allows PENDING → CALLING", () => {
      expect(canTransition("PENDING", "CALLING")).toBe(true);
    });

    it("allows PENDING → COLD", () => {
      expect(canTransition("PENDING", "COLD")).toBe(true);
    });

    it("allows CALLING → BOOKED", () => {
      expect(canTransition("CALLING", "BOOKED")).toBe(true);
    });

    it("allows CALLING → FAQ_ONLY", () => {
      expect(canTransition("CALLING", "FAQ_ONLY")).toBe(true);
    });

    it("allows BOOKED → REMINDED", () => {
      expect(canTransition("BOOKED", "REMINDED")).toBe(true);
    });

    it("allows REMINDED → VISITED", () => {
      expect(canTransition("REMINDED", "VISITED")).toBe(true);
    });

    it("allows VISITED → CONVERTED", () => {
      expect(canTransition("VISITED", "CONVERTED")).toBe(true);
    });

    it("allows NO_SHOW → FOLLOWUP_D1", () => {
      expect(canTransition("NO_SHOW", "FOLLOWUP_D1")).toBe(true);
    });

    it("rejects PENDING → CONVERTED (skip states)", () => {
      expect(canTransition("PENDING", "CONVERTED")).toBe(false);
    });

    it("rejects COLD → any state (terminal)", () => {
      expect(canTransition("COLD", "PENDING")).toBe(false);
      expect(canTransition("COLD", "BOOKED")).toBe(false);
    });

    it("rejects CONVERTED → any state (terminal)", () => {
      expect(canTransition("CONVERTED", "VISITED")).toBe(false);
    });

    it("rejects unknown status transitions", () => {
      expect(canTransition("UNKNOWN", "PENDING")).toBe(false);
      expect(canTransition("PENDING", "UNKNOWN")).toBe(false);
    });
  });

  describe("getValidTransitions", () => {
    it("returns correct next states for PENDING", () => {
      expect(getValidTransitions("PENDING")).toEqual(["CALLING", "COLD"]);
    });

    it("returns correct next states for CALLING", () => {
      expect(getValidTransitions("CALLING")).toEqual([
        "CALL_FAILED", "NO_ANSWER", "FAQ_ONLY", "BOOKED", "COLD",
      ]);
    });

    it("returns empty array for terminal states", () => {
      expect(getValidTransitions("COLD")).toEqual([]);
      expect(getValidTransitions("CONVERTED")).toEqual([]);
    });

    it("returns empty array for unknown status", () => {
      expect(getValidTransitions("BOGUS")).toEqual([]);
    });
  });

  describe("isTerminal", () => {
    it("returns true for COLD", () => {
      expect(isTerminal("COLD")).toBe(true);
    });

    it("returns true for CONVERTED", () => {
      expect(isTerminal("CONVERTED")).toBe(true);
    });

    it("returns false for active states", () => {
      expect(isTerminal("PENDING")).toBe(false);
      expect(isTerminal("BOOKED")).toBe(false);
      expect(isTerminal("VISITED")).toBe(false);
    });
  });

  describe("isCallable", () => {
    it("returns true for callable states", () => {
      expect(isCallable("PENDING")).toBe(true);
      expect(isCallable("NO_ANSWER")).toBe(true);
      expect(isCallable("CALL_FAILED")).toBe(true);
    });

    it("returns false for non-callable states", () => {
      expect(isCallable("BOOKED")).toBe(false);
      expect(isCallable("CONVERTED")).toBe(false);
      expect(isCallable("COLD")).toBe(false);
    });
  });

  describe("isBookable", () => {
    it("returns true for bookable states", () => {
      expect(isBookable("PENDING")).toBe(true);
      expect(isBookable("FAQ_ONLY")).toBe(true);
      expect(isBookable("NO_SHOW")).toBe(true);
    });

    it("returns false for non-bookable states", () => {
      expect(isBookable("BOOKED")).toBe(false);
      expect(isBookable("CONVERTED")).toBe(false);
    });
  });

  describe("isInFollowup", () => {
    it("returns true for follow-up states", () => {
      expect(isInFollowup("NO_SHOW")).toBe(true);
      expect(isInFollowup("FOLLOWUP_D1")).toBe(true);
      expect(isInFollowup("FOLLOWUP_D2")).toBe(true);
      expect(isInFollowup("FOLLOWUP_D3")).toBe(true);
    });

    it("returns false for non-follow-up states", () => {
      expect(isInFollowup("PENDING")).toBe(false);
      expect(isInFollowup("BOOKED")).toBe(false);
      expect(isInFollowup("COLD")).toBe(false);
    });
  });

  describe("validateTransition", () => {
    it("returns the target status for valid transitions", () => {
      expect(validateTransition("PENDING", "CALLING")).toBe("CALLING");
      expect(validateTransition("VISITED", "CONVERTED")).toBe("CONVERTED");
    });

    it("throws for invalid transitions", () => {
      expect(() => validateTransition("PENDING", "CONVERTED")).toThrow(
        "Invalid transition"
      );
      expect(() => validateTransition("COLD", "PENDING")).toThrow(
        "Invalid transition"
      );
    });
  });
});

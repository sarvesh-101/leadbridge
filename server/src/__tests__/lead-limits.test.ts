import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    client: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import {
  getMonthlyLeadsLimit,
  checkMonthlyLeadsCapacity,
  tryConsumeMonthlyLead,
  monthlyLeadsCapError,
} from "../utils/lead-limits";

const prisma = new PrismaClient();

describe("Monthly Leads Limit helper (FIX Round-2 #6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMonthlyLeadsLimit", () => {
    it("returns the plan's leads allowance from PLAN_DEFINITIONS", () => {
      // STARTER leads: 500, PRO leads: 50000 (from subscription.service.ts)
      expect(getMonthlyLeadsLimit("STARTER")).toBe(500);
      expect(getMonthlyLeadsLimit("PRO")).toBe(50000);
    });

    it("falls back to GROWTH for unknown/trial plans (never NaN)", () => {
      expect(getMonthlyLeadsLimit("TRIAL")).toBe(getMonthlyLeadsLimit("GROWTH"));
      expect(getMonthlyLeadsLimit("BOGUS_PLAN")).toBe(getMonthlyLeadsLimit("GROWTH"));
      expect(Number.isNaN(getMonthlyLeadsLimit("BOGUS_PLAN"))).toBe(false);
    });
  });

  describe("checkMonthlyLeadsCapacity", () => {
    it("returns canIngest=true when under the cap", async () => {
      (prisma.client.findUnique as any).mockResolvedValue({ leadsThisMonth: 10 });
      const result = await checkMonthlyLeadsCapacity(prisma, "client-1", "STARTER");
      expect(result.limit).toBe(500);
      expect(result.used).toBe(10);
      expect(result.canIngest).toBe(true);
    });

    it("returns canIngest=false at the cap (used === limit)", async () => {
      (prisma.client.findUnique as any).mockResolvedValue({ leadsThisMonth: 500 });
      const result = await checkMonthlyLeadsCapacity(prisma, "client-1", "STARTER");
      expect(result.canIngest).toBe(false);
    });

    it("returns canIngest=false over the cap", async () => {
      (prisma.client.findUnique as any).mockResolvedValue({ leadsThisMonth: 501 });
      const result = await checkMonthlyLeadsCapacity(prisma, "client-1", "STARTER");
      expect(result.canIngest).toBe(false);
    });

    it("treats missing client as 0 used", async () => {
      (prisma.client.findUnique as any).mockResolvedValue(null);
      const result = await checkMonthlyLeadsCapacity(prisma, "client-1", "STARTER");
      expect(result.used).toBe(0);
      expect(result.canIngest).toBe(true);
    });
  });

  describe("tryConsumeMonthlyLead", () => {
    it("increments atomically with a lt-limit guard when under cap", async () => {
      (prisma.client.updateMany as any).mockResolvedValue({ count: 1 });
      const ok = await tryConsumeMonthlyLead(prisma, "client-1", "STARTER");
      expect(ok).toBe(true);
      expect(prisma.client.updateMany).toHaveBeenCalledWith({
        where: { id: "client-1", leadsThisMonth: { lt: 500 } },
        data: { leadsThisMonth: { increment: 1 } },
      });
    });

    it("returns false when the guard rejects (at/over cap — race-safe)", async () => {
      (prisma.client.updateMany as any).mockResolvedValue({ count: 0 });
      const ok = await tryConsumeMonthlyLead(prisma, "client-1", "STARTER");
      expect(ok).toBe(false);
    });
  });

  describe("monthlyLeadsCapError", () => {
    it("returns a standard 429-shaped error body", () => {
      const err = monthlyLeadsCapError(500);
      expect(err.error).toContain("500");
      expect(err.limit).toBe(500);
      expect(err.retryAfter).toBe("billing_cycle");
    });
  });
});

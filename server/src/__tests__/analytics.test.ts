import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    lead: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    territory: { findMany: vi.fn() },
    client: {
      findUnique: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import { getConversionFunnel, getChurnPredictions, getROIAnalysis } from "../services/analytics.service";
const prisma = new PrismaClient();

describe("Analytics Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConversionFunnel", () => {
    it("builds a funnel with correct stage counts", async () => {
      (prisma.lead.count as any).mockResolvedValue(100);

      const funnel = await getConversionFunnel("client-1");
      expect(funnel).toHaveLength(6);
      expect(funnel[0].stage).toBe("PENDING");
      expect(funnel[0].count).toBe(100);
    });

    it("calculates drop-off percentages correctly", async () => {
      // Simulate decreasing counts through the funnel
      const counts = [100, 80, 60, 40, 20, 10];
      let callIndex = 0;
      (prisma.lead.count as any).mockImplementation(() => Promise.resolve(counts[callIndex++]));

      const funnel = await getConversionFunnel("client-1");
      expect(funnel[0].count).toBe(100);   // PENDING
      expect(funnel[1].count).toBe(80);    // CALLING (20% drop)
      expect(funnel[5].count).toBe(10);    // CONVERTED
      // PENDING → CALLING drop: 20%
      expect(funnel[1].dropOffPercent).toBe(20);
    });
  });

  describe("getChurnPredictions", () => {
    it("returns empty array when no active leads", async () => {
      (prisma.lead.findMany as any).mockResolvedValue([]);
      const result = await getChurnPredictions("client-1");
      expect(result).toEqual([]);
    });

    it("flags leads with high risk factors", async () => {
      const mockLead = {
        id: "lead-1",
        name: "At-Risk Lead",
        phone: "+919876543210",
        status: "PENDING",
        callAttempts: 2,
        maxAttempts: 3,
        sentiment: "negative",
        receivedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        calls: [{ status: "NO_ANSWER", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }],
        customerNotifications: [],
      };
      (prisma.lead.findMany as any).mockResolvedValue([mockLead]);

      const result = await getChurnPredictions("client-1");
      expect(result).toHaveLength(1);
      expect(result[0].riskScore).toBeGreaterThanOrEqual(60);
      expect(result[0].riskFactors.length).toBeGreaterThanOrEqual(3);
    });

    it("flags leads with low risk factors", async () => {
      const freshLead = {
        id: "lead-2",
        name: "Fresh Lead",
        phone: "+919876543210",
        status: "FAQ_ONLY",
        callAttempts: 0,
        maxAttempts: 3,
        sentiment: "positive",
        receivedAt: new Date(),
        calls: [{ status: "COMPLETED", createdAt: new Date() }],
        customerNotifications: [],
      };
      (prisma.lead.findMany as any).mockResolvedValue([freshLead]);

      const result = await getChurnPredictions("client-1");
      expect(result[0].riskScore).toBeLessThan(20);
      expect(result[0].recommendedAction).toContain("call");
    });
  });

  describe("getROIAnalysis", () => {
    it("returns null when client not found", async () => {
      (prisma.client.findUnique as any).mockResolvedValue(null);
      const result = await getROIAnalysis("nonexistent");
      expect(result).toBeNull();
    });

    it("calculates ROI based on lead data", async () => {
      const mockClient = {
        id: "client-1",
        leads: [
          { status: "CONVERTED" },
          { status: "CONVERTED" },
          { status: "BOOKED" },
          { status: "COLD" },
        ],
        calls: [{}, {}, {}, {}],
        bookings: [{}, {}],
      };
      (prisma.client.findUnique as any).mockResolvedValue(mockClient);

      const result = await getROIAnalysis("client-1");
      expect(result).not.toBeNull();
      expect(result!.totalLeads).toBe(4);
      expect(result!.conversions).toBe(2);
      expect(result!.conversionRate).toBe(50);
      expect(result!.costPerLead).toBeGreaterThan(0);
      expect(result!.roi).toContain("%");
    });
  });
});

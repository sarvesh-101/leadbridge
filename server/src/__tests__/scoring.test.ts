import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

// Mock Prisma
vi.mock("@prisma/client", () => {
  const mockPrisma = {
    lead: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import { scoreLead, getTopLeads, predictWeeklyConversions } from "../services/scoring.service";
const prisma = new PrismaClient();

describe("Scoring Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scoreLead", () => {
    it("returns 0 score for non-existent lead", async () => {
      (prisma.lead.findUnique as any).mockResolvedValue(null);
      const result = await scoreLead("nonexistent");
      expect(result.score).toBe(0);
      expect(result.factors).toEqual({ error: 0 });
    });

    it("scores a lead with complete data", async () => {
      const mockLead = {
        id: "lead-1",
        source: "99acres",
        receivedAt: new Date("2024-01-01T10:00:00Z"),
        firstCalledAt: new Date("2024-01-01T10:02:00Z"),
        timeline: "immediate",
        budget: "1Cr-2Cr",
        propertyType: "flat",
        sentiment: "positive",
        location: "Mumbai Andheri",
        client: { city: "Mumbai", zone: "Andheri" },
      };
      (prisma.lead.findUnique as any).mockResolvedValue(mockLead);

      const result = await scoreLead("lead-1");
      expect(result.score).toBeGreaterThan(50);
      expect(result.score).toBeLessThanOrEqual(100);

      // Check factors exist
      expect(result.factors.source).toBeDefined();
      expect(result.factors.timeline).toBeDefined();
      expect(result.factors.budget).toBeDefined();
      expect(result.factors.sentiment).toBe(10); // positive boost
    });

    it("penalizes negative sentiment", async () => {
      const mockLead = {
        id: "lead-2",
        source: "justdial",
        receivedAt: new Date("2024-01-01T10:00:00Z"),
        firstCalledAt: new Date("2024-01-01T10:30:00Z"),
        timeline: "browsing",
        budget: "under-50L",
        propertyType: "commercial",
        sentiment: "negative",
        location: "Delhi",
        client: { city: "Mumbai", zone: null },
      };
      (prisma.lead.findUnique as any).mockResolvedValue(mockLead);

      const result = await scoreLead("lead-2");
      expect(result.factors.sentiment).toBe(-15);
      expect(result.score).toBeLessThan(60);
    });

    it("updates the lead score in the database", async () => {
      const mockLead = {
        id: "lead-3",
        source: "referral",
        receivedAt: new Date("2024-01-01T10:00:00Z"),
        firstCalledAt: new Date("2024-01-01T10:01:00Z"),
        timeline: "1-3months",
        budget: "50L-1Cr",
        propertyType: "villa",
        sentiment: null,
        location: "Mumbai",
        client: { city: "Mumbai", zone: null },
      };
      (prisma.lead.findUnique as any).mockResolvedValue(mockLead);

      await scoreLead("lead-3");
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: "lead-3" },
        data: { score: expect.any(Number) },
      });
    });
  });

  describe("predictWeeklyConversions", () => {
    it("returns empty prediction when no leads exist", async () => {
      (prisma.lead.findMany as any).mockResolvedValue([]);
      const result = await predictWeeklyConversions("client-1");
      expect(result.likelyToConvert).toBe(0);
      expect(result.leads).toEqual([]);
    });
  });
});

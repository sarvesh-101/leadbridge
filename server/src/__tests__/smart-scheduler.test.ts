import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    lead: {
      findUnique: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import { getOptimalCallTime, getOptimalFollowupTiming } from "../services/smart-scheduler.service";
const prisma = new PrismaClient();

describe("Smart Scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOptimalCallTime", () => {
    it("returns default time when lead not found", async () => {
      (prisma.lead.findUnique as any).mockResolvedValue(null);
      const result = await getOptimalCallTime("nonexistent", "QUALIFICATION");
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });

    it("schedules during peak hours for known source", async () => {
      const now = new Date();
      const mockLead = {
        id: "lead-1",
        source: "99acres",
        client: { city: "Mumbai" },
        calls: [],
      };
      (prisma.lead.findUnique as any).mockResolvedValue(mockLead);

      const result = await getOptimalCallTime("lead-1", "QUALIFICATION", 0);
      expect(result.getHours()).toBeGreaterThanOrEqual(10);
      expect(result.getHours()).toBeLessThanOrEqual(20);
    });
  });

  describe("getOptimalFollowupTiming", () => {
    it("returns default timings when lead not found", async () => {
      (prisma.lead.findUnique as any).mockResolvedValue(null);
      const result = await getOptimalFollowupTiming("nonexistent");
      expect(result.d1Delay).toBe(4 * 60 * 60 * 1000);
      expect(result.d2Delay).toBe(24 * 60 * 60 * 1000);
      expect(result.d3Delay).toBe(24 * 60 * 60 * 1000);
    });

    it("calculates timings based on past call patterns", async () => {
      const mockLead = {
        id: "lead-1",
        source: "magicbricks",
        client: { city: "Mumbai" },
        calls: [
          { duration: 60, createdAt: new Date("2024-01-01T15:00:00Z") },
          { duration: 45, createdAt: new Date("2024-01-02T10:00:00Z") },
        ],
      };
      (prisma.lead.findUnique as any).mockResolvedValue(mockLead);

      const result = await getOptimalFollowupTiming("lead-1");
      expect(result.d1Delay).toBeGreaterThanOrEqual(4 * 60 * 60 * 1000);
      expect(result.d2Delay).toBeGreaterThan(result.d1Delay);
      expect(result.d3Delay).toBeGreaterThan(result.d2Delay);
    });
  });
});

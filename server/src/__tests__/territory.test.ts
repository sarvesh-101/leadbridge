import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    territory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

import {
  getAvailableTerritories,
  assignTerritory,
  releaseTerritory,
  isTerritoryAvailable,
  getClientTerritory,
} from "../services/territory.service";

const prisma = new PrismaClient();

describe("Territory Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAvailableTerritories", () => {
    it("returns unlocked territories sorted by tier and city", async () => {
      const mockTerritories = [
        { id: "t1", city: "Mumbai", zone: "Andheri", tier: 1, locked: false, clientId: null },
        { id: "t2", city: "Delhi", zone: null, tier: 1, locked: false, clientId: null },
      ];
      (prisma.territory.findMany as any).mockResolvedValue(mockTerritories);

      const result = await getAvailableTerritories(prisma);
      expect(result).toEqual(mockTerritories);
      expect(prisma.territory.findMany).toHaveBeenCalledWith({
        where: { locked: false, clientId: null },
        orderBy: [{ tier: "asc" }, { city: "asc" }],
      });
    });

    it("returns empty array when no territories available", async () => {
      (prisma.territory.findMany as any).mockResolvedValue([]);
      const result = await getAvailableTerritories(prisma);
      expect(result).toEqual([]);
    });
  });

  describe("assignTerritory", () => {
    it("assigns an available territory to a client", async () => {
      // findFirst #1 = existing linked row (none); findFirst #2 = target row (free)
      (prisma.territory.findFirst as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "t1", city: "Mumbai", zone: "Andheri", tier: 1, locked: false, clientId: null });
      (prisma.territory.update as any).mockResolvedValue({ id: "t1", city: "Mumbai", zone: "Andheri", tier: 1 });
      (prisma.client.update as any).mockResolvedValue({ id: "client-1", city: "Mumbai", zone: "Andheri" });

      const result = await assignTerritory(prisma, "client-1", "Mumbai", "Andheri");
      expect(result.territory?.id).toBe("t1");
      expect(result.territory?.city).toBe("Mumbai");
      expect(result.client.city).toBe("Mumbai");
      expect(prisma.territory.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "t1" }, data: { clientId: "client-1", locked: true } })
      );
    });

    it("soft model: creates a new territory row when none exists (never blocks)", async () => {
      (prisma.territory.findFirst as any)
        .mockResolvedValueOnce(null) // existing linked row
        .mockResolvedValueOnce(null); // target row not found
      (prisma.territory.create as any).mockResolvedValue({
        id: "t-new", city: "Mumbai", zone: "Andheri", tier: 2, clientId: "client-1", locked: true,
      });
      (prisma.client.update as any).mockResolvedValue({
        id: "client-1", city: "Mumbai", zone: "Andheri",
      });

      const result = await assignTerritory(prisma, "client-1", "Mumbai", "Andheri");
      expect(result.territory?.id).toBe("t-new");
      expect(result.territory?.city).toBe("Mumbai");
      expect(result.client.city).toBe("Mumbai");
      expect(prisma.territory.create).toHaveBeenCalled();
    });

    it("soft model: does NOT steal a taken territory — client still gets service area", async () => {
      // No existing linked row, target row exists but is taken by another broker
      (prisma.territory.findFirst as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "t1", city: "Mumbai", zone: "Western Suburbs", tier: 1, locked: true, clientId: "other-client",
        });
      (prisma.client.update as any).mockResolvedValue({
        id: "client-1", city: "Mumbai", zone: "Western Suburbs",
      });

      const result = await assignTerritory(prisma, "client-1", "Mumbai", "Western Suburbs");
      // No territory row linked (still owned by other broker) but client has service area
      expect(result.territory).toBeNull();
      expect(result.client.city).toBe("Mumbai");
      expect(prisma.territory.update).not.toHaveBeenCalled();
    });

    it("works without zone parameter", async () => {
      (prisma.territory.findFirst as any)
        .mockResolvedValueOnce(null) // existing linked row
        .mockResolvedValueOnce({ id: "t2", city: "Delhi", zone: null, tier: 1, locked: false, clientId: null });
      (prisma.territory.update as any).mockResolvedValue({ id: "t2", city: "Delhi", zone: null, tier: 1 });
      (prisma.client.update as any).mockResolvedValue({ id: "client-2", city: "Delhi", zone: null });

      const result = await assignTerritory(prisma, "client-2", "Delhi");
      expect(result.territory?.city).toBe("Delhi");
      expect(result.client.city).toBe("Delhi");
    });

    it("soft model: same service area already linked keeps the row (no double-link)", async () => {
      (prisma.territory.findFirst as any).mockResolvedValueOnce({
        id: "t1", city: "Mumbai", zone: "Andheri", tier: 1, clientId: "client-1",
      });
      (prisma.client.update as any).mockResolvedValue({ id: "client-1", city: "Mumbai", zone: "Andheri" });

      const result = await assignTerritory(prisma, "client-1", "Mumbai", "Andheri");
      expect(result.territory?.id).toBe("t1");
      expect(result.client.city).toBe("Mumbai");
      // No relink/update needed — same row kept
      expect(prisma.territory.update).not.toHaveBeenCalled();
      expect(prisma.territory.create).not.toHaveBeenCalled();
    });
  });

  describe("releaseTerritory", () => {
    it("releases a client's territory", async () => {
      const mockClient = {
        id: "client-1",
        territory: { id: "t1", city: "Mumbai", zone: "Andheri", locked: true, clientId: "client-1" },
      };
      (prisma.client.findUnique as any).mockResolvedValue(mockClient);
      (prisma.$transaction as any).mockResolvedValue([{}, {}]);

      await releaseTerritory(prisma, "client-1");
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("throws when client has no territory", async () => {
      (prisma.client.findUnique as any).mockResolvedValue({ id: "client-1", territory: null });
      await expect(releaseTerritory(prisma, "client-1")).rejects.toThrow(
        "Client has no assigned territory"
      );
    });
  });

  describe("isTerritoryAvailable", () => {
    it("returns true when territory does not exist", async () => {
      (prisma.territory.findFirst as any).mockResolvedValue(null);
      const result = await isTerritoryAvailable(prisma, "NewCity");
      expect(result).toBe(true);
    });

    it("returns true when territory exists but is unlocked", async () => {
      (prisma.territory.findFirst as any).mockResolvedValue({
        id: "t1", city: "Mumbai", locked: false, clientId: null,
      });
      const result = await isTerritoryAvailable(prisma, "Mumbai");
      expect(result).toBe(true);
    });

    it("returns false when territory is locked", async () => {
      (prisma.territory.findFirst as any).mockResolvedValue({
        id: "t1", city: "Mumbai", locked: true, clientId: "someone",
      });
      const result = await isTerritoryAvailable(prisma, "Mumbai");
      expect(result).toBe(false);
    });
  });

  describe("getClientTerritory", () => {
    it("returns the client's territory", async () => {
      const mockTerritory = { id: "t1", city: "Mumbai", locked: true, clientId: "client-1" };
      (prisma.territory.findUnique as any).mockResolvedValue(mockTerritory);
      const result = await getClientTerritory(prisma, "client-1");
      expect(result).toEqual(mockTerritory);
      expect(prisma.territory.findUnique).toHaveBeenCalledWith({ where: { clientId: "client-1" } });
    });
  });
});

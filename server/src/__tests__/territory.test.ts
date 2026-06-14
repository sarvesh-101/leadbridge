import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    territory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
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
      const mockTerritory = { id: "t1", city: "Mumbai", zone: "Andheri", tier: 1, locked: false, clientId: null };
      (prisma.territory.findFirst as any).mockResolvedValue(mockTerritory);
      (prisma.$transaction as any).mockResolvedValue([
        { ...mockTerritory, locked: true, clientId: "client-1" },
        { id: "client-1", city: "Mumbai", zone: "Andheri" },
      ]);

      const result = await assignTerritory(prisma, "client-1", "Mumbai", "Andheri");
      expect(result.territory.locked).toBe(true);
      expect(result.territory.clientId).toBe("client-1");
      expect(result.client.city).toBe("Mumbai");
    });

    it("throws when territory is not available", async () => {
      (prisma.territory.findFirst as any).mockResolvedValue(null);
      await expect(assignTerritory(prisma, "client-1", "Mumbai", "Andheri")).rejects.toThrow(
        "Territory Mumbai - Andheri is not available"
      );
    });

    it("works without zone parameter", async () => {
      const mockTerritory = { id: "t2", city: "Delhi", zone: null, tier: 1, locked: false, clientId: null };
      (prisma.territory.findFirst as any).mockResolvedValue(mockTerritory);
      (prisma.$transaction as any).mockResolvedValue([
        { ...mockTerritory, locked: true, clientId: "client-2" },
        { id: "client-2", city: "Delhi", zone: null },
      ]);

      const result = await assignTerritory(prisma, "client-2", "Delhi");
      expect(result.territory.locked).toBe(true);
      expect(result.client.city).toBe("Delhi");
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

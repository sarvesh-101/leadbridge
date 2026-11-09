/**
 * V2 (T13) — auto-release is off by default and only releases inside the rules.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../config", () => ({
  config: { TERRITORY_AUTO_RELEASE_ENABLED: false, TERRITORY_MIN_MONTHLY_LEADS: 30 },
}));

import { config } from "../config";
import { runTerritoryRelease } from "../cron/territory-release";

function mockDb(territories: any[]) {
  return {
    territory: {
      findMany: vi.fn().mockResolvedValue(territories),
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

describe("territory release", () => {
  beforeEach(() => {
    (config as any).TERRITORY_AUTO_RELEASE_ENABLED = false;
  });

  it("does nothing while disabled (default)", async () => {
    const db = mockDb([{ id: "t1", updatedAt: new Date("2026-01-01"), client: { planStatus: "CANCELLED" } }]);
    const result = await runTerritoryRelease(new Date("2026-11-06"), db);
    expect(result).toEqual({ enabled: false, warned: 0, released: 0 });
    expect(db.territory.update).not.toHaveBeenCalled();
  });

  it("releases a cancelled zone after the 30-day grace", async () => {
    (config as any).TERRITORY_AUTO_RELEASE_ENABLED = true;
    const db = mockDb([
      {
        id: "t1",
        updatedAt: new Date("2026-09-01"),
        client: { planStatus: "CANCELLED", leadsThisMonth: 0 },
      },
    ]);
    const result = await runTerritoryRelease(new Date("2026-11-06"), db);
    expect(result.released).toBe(1);
    expect(db.territory.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { clientId: null, status: "AVAILABLE", locked: false },
    });
  });

  it("keeps an active subscriber's zone", async () => {
    (config as any).TERRITORY_AUTO_RELEASE_ENABLED = true;
    const db = mockDb([
      { id: "t1", updatedAt: new Date("2026-01-01"), client: { planStatus: "ACTIVE", leadsThisMonth: 100 } },
    ]);
    const result = await runTerritoryRelease(new Date("2026-11-06"), db);
    expect(result.released).toBe(0);
    expect(db.territory.update).not.toHaveBeenCalled();
  });
});

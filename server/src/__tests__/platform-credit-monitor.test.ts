import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config", () => ({
  config: {
    PLATFORM_PAUSE_MINUTES: 10,
    PLATFORM_PAUSE_RESUME_MINUTES: 30,
    DEMO_MODE: false,
  },
}));

vi.mock("../utils/prisma-shared", () => ({
  prisma: {
    platformCredit: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("../services/credit-manager.service", () => ({
  getOrCreateCurrentCredit: vi.fn(),
  setPlatformDispatchPaused: vi.fn().mockResolvedValue(undefined),
}));

import { runPlatformCreditMonitor } from "../cron/platform-credit-monitor";
import { getOrCreateCurrentCredit, setPlatformDispatchPaused } from "../services/credit-manager.service";
import { prisma } from "../utils/prisma-shared";

function creditWith(over: Partial<any> = {}) {
  return {
    id: "pc1",
    totalMinutesPurchased: 1000,
    minutesUsed: 0,
    alertThresholdPercent: 20,
    dispatchPaused: false,
    lastAlertSentAt: null as Date | null,
    ...over,
  };
}

describe("V2 (T7) — platform low-credit monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when credits were never configured", async () => {
    (getOrCreateCurrentCredit as any).mockResolvedValue(creditWith({ totalMinutesPurchased: 0 }));
    const r = await runPlatformCreditMonitor();
    expect(r).toEqual({ paused: false, resumed: false, alerted: false });
  });

  it("alerts once when remaining minutes fall under the alert threshold", async () => {
    (getOrCreateCurrentCredit as any).mockResolvedValue(
      creditWith({ minutesUsed: 850 }) // 15% left < 20%
    );
    const r = await runPlatformCreditMonitor();
    expect(r.alerted).toBe(true);
    // writes the rate-limit timestamp
    expect(prisma.platformCredit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pc1" }, data: { lastAlertSentAt: expect.any(Date) } })
    );
  });

  it("does not spam alerts inside the 12h rate-limit window", async () => {
    (getOrCreateCurrentCredit as any).mockResolvedValue(
      creditWith({ minutesUsed: 850, lastAlertSentAt: new Date(Date.now() - 60 * 60 * 1000) })
    );
    const r = await runPlatformCreditMonitor();
    expect(r.alerted).toBe(false);
    expect(prisma.platformCredit.update).not.toHaveBeenCalled();
  });

  it("pauses dispatch when remaining ≤ PLATFORM_PAUSE_MINUTES", async () => {
    (getOrCreateCurrentCredit as any).mockResolvedValue(
      creditWith({ minutesUsed: 995 }) // 5 min left ≤ 10
    );
    const r = await runPlatformCreditMonitor();
    expect(r.paused).toBe(true);
    expect(setPlatformDispatchPaused).toHaveBeenCalledWith(expect.anything(), true);
  });

  it("auto-resumes only after the platform is recharged past the resume floor", async () => {
    (getOrCreateCurrentCredit as any).mockResolvedValue(
      creditWith({ minutesUsed: 900, dispatchPaused: true }) // 100 remaining ≥ 30
    );
    const r = await runPlatformCreditMonitor();
    expect(r.resumed).toBe(true);
    expect(setPlatformDispatchPaused).toHaveBeenCalledWith(expect.anything(), false);
  });

  it("stays paused until enough minutes exist again", async () => {
    (getOrCreateCurrentCredit as any).mockResolvedValue(
      creditWith({ minutesUsed: 995, dispatchPaused: true }) // 5 < 30 → hold
    );
    const r = await runPlatformCreditMonitor();
    expect(r.resumed).toBe(false);
    expect(setPlatformDispatchPaused).not.toHaveBeenCalled();
  });
});

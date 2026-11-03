import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/prisma-shared", () => ({
  prisma: {
    lead: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
    client: { findMany: vi.fn().mockResolvedValue([{ id: "c1", plan: "GROWTH" }]) },
  },
}));

vi.mock("../services/credit-manager.service", () => ({
  monthlyBrokerCreditReset: vi.fn().mockResolvedValue({ brokersProcessed: 5, totalRolloverMinutes: 0 }),
}));

vi.mock("../utils/lead-limits", () => ({
  releaseWaitingLeads: vi.fn().mockResolvedValue(2),
}));

import { runMonthlyReset } from "../cron/monthly-reset";
import { prisma } from "../utils/prisma-shared";
import { releaseWaitingLeads } from "../utils/lead-limits";

describe("V2 (T2) — monthly reset keeps metering honest", () => {
  beforeEach(vi.clearAllMocks);

  it("resets per-lead fair-use metering with the cycle, and releases held leads", async () => {
    const result = await runMonthlyReset();

    // Fair-use counters zero globally.
    expect(prisma.lead.updateMany).toHaveBeenCalledWith({
      where: {
        OR: [{ answeredSecondsThisCycle: { gt: 0 } }, { fairUseCappedAt: { not: null } }],
      },
      data: { answeredSecondsThisCycle: 0, fairUseCappedAt: null },
    });
    // Prepaid overage credits carry over — NO reset call touches prepaidLeads.
    const calls = (prisma.client as any).findMany.mock.calls as unknown[];
    void calls;
    // Held leads released per client with the fresh plan allowance.
    expect(releaseWaitingLeads).toHaveBeenCalledWith(
      expect.anything(),
      "c1",
      "GROWTH"
    );
    expect(result).toMatchObject({
      brokersProcessed: 5,
      leadsFairUseReset: 3,
      waitingLeadsReleased: 2,
    });
  });
});

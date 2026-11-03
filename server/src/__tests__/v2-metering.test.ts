import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@prisma/client", () => {
  const mockPrisma = {
    client: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    lead: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  return { PrismaClient: vi.fn(() => mockPrisma) };
});

vi.mock("../workers/queues", () => ({
  enqueueCall: vi.fn().mockResolvedValue({ id: "job" }),
}));

vi.mock("../services/lead-assignment.service", () => ({
  assignLead: vi.fn().mockResolvedValue({}),
}));

import {
  consumeLeadAllowance,
  recordAnsweredSeconds,
  releaseWaitingLeads,
  FAIR_USE_SECONDS_PER_LEAD,
} from "../utils/lead-limits";
import { enqueueCall } from "../workers/queues";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient() as any;

/** updateMany mock keyed by which counter the call touches. */
function mockUpdateManyByCounter(leadGuardResult: number, prepaidResult: number) {
  prisma.client.updateMany.mockImplementation((args: any) => {
    if (args?.data?.prepaidLeads !== undefined) {
      return Promise.resolve({ count: prepaidResult });
    }
    return Promise.resolve({ count: leadGuardResult });
  });
}

describe("V2 (T2) — leads-handled metering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("consumeLeadAllowance", () => {
    it('returns "plan" while the monthly allowance lasts', async () => {
      mockUpdateManyByCounter(1, 0);
      const mode = await consumeLeadAllowance(prisma, "c1", "STARTER");
      expect(mode).toBe("plan");
      // Prepaid credit untouched, prepaidLeads leak NOT incremented.
      expect(prisma.client.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.client.update).not.toHaveBeenCalled();
    });

    it('falls back to one prepaid overage credit when the plan is exhausted', async () => {
      mockUpdateManyByCounter(0, 1);
      prisma.client.update.mockResolvedValue({});
      const mode = await consumeLeadAllowance(prisma, "c1", "STARTER");
      expect(mode).toBe("overage");
      // Atomic guard: prepaidLeads > 0, decrement by 1.
      expect(prisma.client.updateMany).toHaveBeenCalledWith({
        where: { id: "c1", prepaidLeads: { gt: 0 } },
        data: { prepaidLeads: { decrement: 1 } },
      });
      // Usage counter still shows the lead as handled.
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { leadsThisMonth: { increment: 1 } },
      });
    });

    it('returns "none" when plan AND prepaid credit are both exhausted (never silently drops)', async () => {
      mockUpdateManyByCounter(0, 0);
      const mode = await consumeLeadAllowance(prisma, "c1", "STARTER");
      expect(mode).toBe("none");
      expect(prisma.client.update).not.toHaveBeenCalled();
    });
  });

  describe("recordAnsweredSeconds (fair-use)", () => {
    it("uses the 8-minute ceiling from config", () => {
      expect(FAIR_USE_SECONDS_PER_LEAD).toBe(480);
    });

    it("does NOT cap below 480 answered seconds", async () => {
      prisma.lead.update.mockResolvedValueOnce({ answeredSecondsThisCycle: 479, fairUseCappedAt: null });
      const gotCapped = await recordAnsweredSeconds(prisma, "l1", 479);
      expect(gotCapped).toBe(false);
      expect(prisma.lead.update).toHaveBeenCalledTimes(1);
    });

    it("caps exactly at 480s, sets FAIR_USE_CAP + fairUseCappedAt once, notifies once", async () => {
      prisma.lead.update
        .mockResolvedValueOnce({ answeredSecondsThisCycle: 480, fairUseCappedAt: null })
        .mockResolvedValueOnce({ id: "l1" });
      const gotCapped = await recordAnsweredSeconds(prisma, "l1", 180);
      expect(gotCapped).toBe(true);
      expect(prisma.lead.update).toHaveBeenLastCalledWith({
        where: { id: "l1" },
        data: { fairUseCappedAt: expect.any(Date), status: "FAIR_USE_CAP" },
      });
    });

    it("does not re-cap an already-capped lead (no duplicate owner notifications)", async () => {
      prisma.lead.update.mockResolvedValueOnce({
        answeredSecondsThisCycle: 500,
        fairUseCappedAt: new Date(),
      });
      const gotCapped = await recordAnsweredSeconds(prisma, "l1", 20);
      expect(gotCapped).toBe(false);
      // Second update (cap-set) never fired.
      expect(prisma.lead.update).toHaveBeenCalledTimes(1);
    });

    it("ignores zero-second (non-answered) calls — no DB write at all", async () => {
      const gotCapped = await recordAnsweredSeconds(prisma, "l1", 0);
      expect(gotCapped).toBe(false);
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });
  });

  describe("releaseWaitingLeads (held leads release in queue order)", () => {
    it("releases held leads oldest-first while allowance exists", async () => {
      prisma.lead.findMany.mockResolvedValue([{ id: "l-old" }, { id: "l-new" }]);
      mockUpdateManyByCounter(1, 0); // plan allowance available

      const released = await releaseWaitingLeads(prisma, "c1", "STARTER");

      expect(released).toBe(2);
      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId: "c1", status: "QUEUED_WAITING_CREDITS" },
          orderBy: { receivedAt: "asc" },
        })
      );
      // Each lead flips back to PENDING and re-enters the AI pipeline.
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: "l-old" },
        data: { status: "PENDING" },
      });
      expect(enqueueCall).toHaveBeenCalledTimes(2);
      expect(enqueueCall).toHaveBeenCalledWith(
        { leadId: "l-old", clientId: "c1", callType: "QUALIFICATION", attempt: 1 }
      );
    });

    it("stops at the first lead when allowance runs out mid-queue (queue order preserved)", async () => {
      prisma.lead.findMany.mockResolvedValue([{ id: "l1" }, { id: "l2" }, { id: "l3" }]);
      // First consume succeeds ("plan"), all later consumes find nothing.
      let calls = 0;
      prisma.client.updateMany.mockImplementation(() => {
        calls += 1;
        return Promise.resolve({ count: calls === 1 ? 1 : 0 });
      });

      const released = await releaseWaitingLeads(prisma, "c1", "STARTER");
      expect(released).toBe(1);
      expect(prisma.lead.update).toHaveBeenCalledTimes(1);
    });
  });
});

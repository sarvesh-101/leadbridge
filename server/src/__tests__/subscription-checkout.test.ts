import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";

// Mock the Razorpay service so tests never hit the network
vi.mock("../services/razorpay.service", () => ({
  createSubscription: vi.fn(),
  getPlanIds: vi.fn(),
  cancelSubscription: vi.fn().mockResolvedValue(undefined),
  refundPayment: vi.fn(),
  verifyWebhookSignature: vi.fn(),
  getInvoice: vi.fn(),
}));

import {
  PLAN_DEFINITIONS,
  RAZORPAY_TOTAL_COUNT,
  createSubscriptionCheckout,
  getRazorpayPlanIdForTier,
} from "../services/subscription.service";
import {
  createSubscription,
  getPlanIds,
  cancelSubscription,
} from "../services/razorpay.service";

const mockCreateSubscription = createSubscription as ReturnType<typeof vi.fn>;
const mockGetPlanIds = getPlanIds as ReturnType<typeof vi.fn>;
const mockCancelSubscription = cancelSubscription as ReturnType<typeof vi.fn>;

const mockPrisma = {
  subscription: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  client: {
    update: vi.fn(),
  },
  invoice: {
    create: vi.fn(),
  },
};

const mockFastify = {
  prisma: mockPrisma,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
} as unknown as FastifyInstance;

const client = {
  id: "client-1",
  email: "broker@test.com",
  phone: "+919000000000",
  ownerName: "Test Broker",
  trialStartedAt: new Date("2026-07-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPlanIds.mockReturnValue({
    starter: "plan_starter",
    growth: "plan_growth",
    pro: "plan_pro",
  });
  mockCreateSubscription.mockResolvedValue({
    id: "sub_live_123",
    shortUrl: "https://rzp.io/test",
    status: "created",
  });
  mockPrisma.subscription.findMany.mockResolvedValue([]);
  mockPrisma.subscription.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "sub_db_1", ...data })
  );
  mockPrisma.invoice.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "inv_1", ...data })
  );
  mockPrisma.client.update.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: client.id, ...data })
  );
});

describe("createSubscriptionCheckout (shared checkout — both paths)", () => {
  it("creates the live Razorpay sub with totalCount 1200 + STARTER trial, then DB sub + SENT invoice", async () => {
    const result = await createSubscriptionCheckout(mockFastify, client, "GROWTH");

    // Razorpay called with the plan ID + total_count 1200 (renews until cancelled)
    expect(mockCreateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plan_growth",
        totalCount: RAZORPAY_TOTAL_COUNT,
        customerEmail: client.email,
      })
    );
    expect(mockCreateSubscription.mock.calls[0][0].trialDays).toBe(0);

    // DB subscription created with limits + provider id + ACTIVE
    const subData = mockPrisma.subscription.create.mock.calls[0][0].data;
    expect(subData).toMatchObject({
      clientId: client.id,
      planTier: "GROWTH",
      status: "ACTIVE",
      amount: PLAN_DEFINITIONS.GROWTH.monthly,
      providerSubscriptionId: "sub_live_123",
      limits: { users: 15, leads: 3000, calls: 500 },
      autoRenew: true,
    });

    // SENT invoice for the cycle
    const invData = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(invData.status).toBe("SENT");
    expect(invData.amount).toBe(PLAN_DEFINITIONS.GROWTH.monthly);
    expect(invData.subscriptionId).toBe("sub_db_1");

    // Client updated with plan + callsLimit + trial→paid conversion
    expect(mockPrisma.client.update).toHaveBeenCalled();
    const clientData = mockPrisma.client.update.mock.calls[0][0].data;
    expect(clientData.callsLimit).toBe(500);
    expect(clientData.planStatus).toBe("ACTIVE");
    expect(clientData.convertedFromTrialAt).toBeInstanceOf(Date);

    expect(result.paymentUrl).toBe("https://rzp.io/test");
  });

  it("passes 14-day trial for STARTER", async () => {
    await createSubscriptionCheckout(mockFastify, client, "STARTER");
    expect(mockCreateSubscription.mock.calls[0][0].trialDays).toBe(14);
  });

  it("cancels prior DB subscriptions AND their live Razorpay subs (FIX #11)", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { id: "old-db-1", providerSubscriptionId: "sub_old_1" },
      { id: "old-db-2", providerSubscriptionId: null },
    ]);

    await createSubscriptionCheckout(mockFastify, client, "GROWTH");

    // Old live Razorpay sub cancelled (the one with a provider id)
    expect(mockCancelSubscription).toHaveBeenCalledTimes(1);
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_old_1");

    // DB rows cancelled
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: client.id, status: { in: ["ACTIVE", "TRIAL"] } },
        data: expect.objectContaining({ status: "CANCELLED" }),
      })
    );
  });

  it("does NOT cancel the new sub or duplicate cancels when no prior subs exist", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);
    await createSubscriptionCheckout(mockFastify, client, "GROWTH");
    expect(mockCancelSubscription).not.toHaveBeenCalled();
    expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it("gracefully degrades (PENDING / TRIAL) when Razorpay fails in non-strict mode", async () => {
    mockCreateSubscription.mockRejectedValue(new Error("rate limit"));
    const result = await createSubscriptionCheckout(mockFastify, client, "GROWTH");

    expect(result.paymentUrl).toBeNull();
    expect(result.razorpaySub).toBeNull();
    const subData = mockPrisma.subscription.create.mock.calls[0][0].data;
    expect(subData.status).toBe("PENDING");
    expect(subData.providerSubscriptionId).toBeNull();
    expect(mockPrisma.client.update.mock.calls[0][0].data.planStatus).toBe("TRIAL");
  });

  it("throws in strict mode (legacy path behaviour) when Razorpay fails", async () => {
    mockCreateSubscription.mockRejectedValue(new Error("rate limit"));
    await expect(
      createSubscriptionCheckout(mockFastify, client, "GROWTH", { strict: true })
    ).rejects.toThrow("rate limit");
    // No DB rows created on a failed strict checkout
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("throws for an invalid plan tier", async () => {
    await expect(
      createSubscriptionCheckout(mockFastify, client, "ULTIMATE")
    ).rejects.toThrow("Invalid plan tier");
  });

  it("throws in strict mode when the Razorpay plan id is unconfigured (legacy 400 path)", async () => {
    mockGetPlanIds.mockReturnValue({ starter: "", growth: "pg", pro: "pp" });
    await expect(
      createSubscriptionCheckout(mockFastify, client, "STARTER", { strict: true })
    ).rejects.toThrow("Invalid plan selected or plan not configured");
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
  });

  it("never passes the new live sub id to cancelSubscription", async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { id: "old-db-1", providerSubscriptionId: "sub_old_1" },
    ]);
    await createSubscriptionCheckout(mockFastify, client, "GROWTH");
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_old_1");
    expect(mockCancelSubscription).not.toHaveBeenCalledWith("sub_live_123");
  });
});

describe("getRazorpayPlanIdForTier", () => {
  it("maps tiers to configured Razorpay plan ids", () => {
    mockGetPlanIds.mockReturnValue({
      starter: "ps",
      growth: "pg",
      pro: "pp",
    });
    expect(getRazorpayPlanIdForTier("STARTER")).toBe("ps");
    expect(getRazorpayPlanIdForTier("GROWTH")).toBe("pg");
    expect(getRazorpayPlanIdForTier("PRO")).toBe("pp");
  });

  it("returns empty string for unconfigured plans", () => {
    mockGetPlanIds.mockReturnValue({ starter: "", growth: "pg", pro: "pp" });
    expect(getRazorpayPlanIdForTier("STARTER")).toBe("");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  ensureInvoiceForCycle,
  recordPaymentAndRevenue,
} from "../routes/webhooks/razorpay";

const mockPrisma = {
  invoice: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  payment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  client: {
    update: vi.fn(),
  },
};

const mockFastify = {
  prisma: mockPrisma,
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
} as unknown as FastifyInstance;

const subscription = {
  id: "sub_db_1",
  planName: "Growth",
  startDate: new Date("2026-08-05T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.invoice.findFirst.mockResolvedValue(null);
  mockPrisma.invoice.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "inv_ren_1", ...data })
  );
  mockPrisma.payment.findFirst.mockResolvedValue(null);
  mockPrisma.payment.create.mockImplementation(({ data }: any) =>
    Promise.resolve({ id: "pay_1", ...data })
  );
});

describe("ensureInvoiceForCycle (FIX #9 renewal invoices)", () => {
  it("generates a renewal invoice for a month-2 charge with the correct cycle window", async () => {
    const chargeDate = new Date("2026-09-05T00:00:00Z"); // 1 full month after start
    const invoice = await ensureInvoiceForCycle(mockFastify, "client-1", subscription, chargeDate, 35000);

    expect(invoice).toBeTruthy();
    const data = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      clientId: "client-1",
      subscriptionId: "sub_db_1",
      status: "SENT",
      amount: 35000,
      description: "Growth (Monthly) — Renewal cycle 2",
    });
    // cycleStart = start + 1 month, cycleEnd = +2 months
    expect(data.periodStart.toISOString()).toBe("2026-09-05T00:00:00.000Z");
    expect(data.periodEnd.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(data.dueDate.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("reuses an existing invoice for the cycle (idempotent — never duplicates)", async () => {
    const existing = { id: "inv_existing", status: "SENT" };
    mockPrisma.invoice.findFirst.mockResolvedValue(existing);

    const chargeDate = new Date("2026-09-05T00:00:00Z");
    const invoice = await ensureInvoiceForCycle(mockFastify, "client-1", subscription, chargeDate, 35000);

    expect(invoice).toEqual(existing);
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
  });

  it("returns null and creates nothing when the amount is missing/zero", async () => {
    const chargeDate = new Date("2026-09-05T00:00:00Z");
    const invoice = await ensureInvoiceForCycle(mockFastify, "client-1", subscription, chargeDate, 0);

    expect(invoice).toBeNull();
    expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    expect(mockPrisma.invoice.findFirst).not.toHaveBeenCalled();
  });

  it("treats a same-month charge as cycle 1 (no elapsed months)", async () => {
    const chargeDate = new Date("2026-08-20T00:00:00Z"); // same month as start
    await ensureInvoiceForCycle(mockFastify, "client-1", subscription, chargeDate, 35000);

    const data = mockPrisma.invoice.create.mock.calls[0][0].data;
    expect(data.description).toBe("Growth (Monthly) — Renewal cycle 1");
    expect(data.periodStart.toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });
});

describe("recordPaymentAndRevenue", () => {
  it("creates a Payment row + increments client revenue", async () => {
    await recordPaymentAndRevenue(mockFastify, "client-1", {
      invoiceId: "inv_1",
      amountInr: 35000,
      paymentId: "pay_rzp_1",
      paymentMethod: "upi",
    });

    const payData = mockPrisma.payment.create.mock.calls[0][0].data;
    expect(payData).toMatchObject({
      clientId: "client-1",
      invoiceId: "inv_1",
      amount: 35000,
      status: "SUCCESSFUL",
      providerPaymentId: "pay_rzp_1",
    });
    expect(mockPrisma.client.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { totalRevenueGenerated: { increment: 35000 } },
    });
  });

  it("is idempotent on providerPaymentId (redelivered webhook never double-counts)", async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({ id: "existing_pay" });

    await recordPaymentAndRevenue(mockFastify, "client-1", {
      invoiceId: "inv_1",
      amountInr: 35000,
      paymentId: "pay_rzp_1",
    });

    expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it("skips when amount is zero/missing", async () => {
    await recordPaymentAndRevenue(mockFastify, "client-1", {
      invoiceId: "inv_1",
      amountInr: 0,
      paymentId: "pay_rzp_1",
    });

    expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });
});

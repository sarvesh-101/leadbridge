/**
 * V2 (T11) — proof metric definitions, including empty periods and division by zero.
 */
import { describe, expect, it } from "vitest";
import { computeProofMetrics, computeProfitability, median, ratio, weekStartFor } from "../services/proof-metrics";

const period = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-08T00:00:00Z") };

const lead = (over: Partial<any> = {}) => ({
  id: "l1",
  receivedAt: new Date("2026-10-02T10:00:00Z"),
  firstCallDelaySeconds: 45,
  status: "PENDING",
  budget: null,
  location: null,
  propertyType: null,
  timeline: null,
  calls: [] as any[],
  ...over,
});

describe("proof metrics", () => {
  it("returns zeros and n/a for an empty period (no NaN / no divide-by-zero)", () => {
    const m = computeProofMetrics([], [], period, 17699);
    expect(m).toEqual({
      leadsReceived: 0,
      medianFirstCallSeconds: null,
      reachRate: 0,
      qualifiedRate: 0,
      visitsBooked: 0,
      visitsCompleted: 0,
      costPerCompletedVisit: "n/a",
    });
  });

  it("ignores leads outside the period", () => {
    const m = computeProofMetrics([lead({ receivedAt: new Date("2026-09-01T00:00:00Z") })], [], period);
    expect(m.leadsReceived).toBe(0);
  });

  it("computes median delay, reach and qualification rates", () => {
    const leads = [
      lead({ id: "a", firstCallDelaySeconds: 30, calls: [{ status: "ANSWERED" }], budget: "50L" }),
      lead({ id: "b", firstCallDelaySeconds: 90, calls: [{ status: "COMPLETED" }], status: "BOOKED" }),
      lead({ id: "c", firstCallDelaySeconds: 60, calls: [{ status: "NO_ANSWER" }] }),
      lead({ id: "d", firstCallDelaySeconds: null, calls: [] }),
    ];
    const m = computeProofMetrics(leads, [], period);
    expect(m.leadsReceived).toBe(4);
    expect(m.medianFirstCallSeconds).toBe(60);
    // 2 reached (a,b) of 3 attempted (a,b,c) → 0.667
    expect(m.reachRate).toBe(0.667);
    // both reached are qualified → 1
    expect(m.qualifiedRate).toBe(1);
  });

  it("prorates plan cost over completed visits", () => {
    const bookings = [
      { visitDate: new Date("2026-10-03T00:00:00Z"), status: "VISITED" },
      { visitDate: new Date("2026-10-04T00:00:00Z"), status: "CONFIRMED" },
      { visitDate: new Date("2026-10-05T00:00:00Z"), status: "CANCELLED" },
    ];
    const m = computeProofMetrics([], bookings, period, 30000);
    expect(m.visitsBooked).toBe(2); // confirmed + visited, cancelled excluded
    expect(m.visitsCompleted).toBe(1);
    expect(m.costPerCompletedVisit).toBe(7000); // 30000 × 7/30
  });

  it("median / ratio helpers never produce NaN", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 2])).toBe(3);
    expect(ratio(1, 0)).toBe(0);
  });

  it("weekStartFor returns Monday 00:00 UTC", () => {
    const monday = weekStartFor(new Date("2026-10-07T15:00:00Z")); // Wednesday
    expect(monday.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("computes platform profitability per plan", () => {
    const [row] = computeProfitability([
      { plan: "GROWTH", planRevenueInclGst: 41299, leadsHandled: 600, leadsFairUseCapped: 60, platformCost: 27600 },
    ]);
    expect(row.avgPlatformCostPerLead).toBe(46);
    expect(row.fairUseCappedShare).toBe(0.1);
    expect(row.grossMargin).toBe(13699);
    expect(row.grossMarginPct).toBe(33.2);
  });
});

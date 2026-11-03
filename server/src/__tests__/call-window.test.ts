import { describe, it, expect, vi } from "vitest";
import {
  isWithinCallingWindow,
  nextWindowStart,
  windowJitterMs,
  firstCallDelayMs,
} from "../utils/call-window";

/** Build a Date from (IST hour, minute) on a known date. */
function ist(h: number, m = 0, day = 15): Date {
  // 2026-11-15T08:30:00Z == 14:00 IST. Offset -5.5h into UTC.
  const baseUtc = Date.UTC(2026, 10, day, 0, 0) - 5.5 * 60 * 60 * 1000;
  return new Date(baseUtc + h * 60 * 60 * 1000 + m * 60 * 1000);
}

describe("V2 (T5) — calling window (always 09:00–21:00 IST, never 24/7)", () => {
  it("accepts in-window calls", () => {
    expect(isWithinCallingWindow(ist(9, 0))).toBe(true);
    expect(isWithinCallingWindow(ist(14, 30))).toBe(true);
    expect(isWithinCallingWindow(ist(20, 59))).toBe(true);
  });

  it("rejects out-of-window calls at both edges", () => {
    expect(isWithinCallingWindow(ist(8, 59))).toBe(false);
    expect(isWithinCallingWindow(ist(21, 0))).toBe(false); // end-exclusive
    expect(isWithinCallingWindow(ist(23, 30))).toBe(false);
    expect(isWithinCallingWindow(ist(3, 0))).toBe(false);
  });

  it("re-queues to today's window start when called early morning", () => {
    const now = ist(7, 0);
    const next = nextWindowStart(now); // → 09:00 IST same day
    expect(next.toISOString()).toBe(new Date(Date.UTC(2026, 10, 15, 9, 0) - 5.5 * 3600_000).toISOString());
  });

  it("re-queues to TOMORROW's window start after 21:00 IST", () => {
    const now = ist(22, 0, 15);
    const next = nextWindowStart(now);
    const expected = new Date(Date.UTC(2026, 10, 16, 9, 0) - 5.5 * 3600_000).toISOString();
    expect(next.toISOString()).toBe(expected);
  });

  it("adds bounded jitter (0 < jitter ≤ 30 min) for queue spreading", () => {
    for (let i = 0; i < 20; i++) {
      const j = windowJitterMs();
      expect(j).toBeGreaterThan(0);
      expect(j).toBeLessThanOrEqual(30 * 60 * 1000);
    }
  });

  it("first outbound attempt is delayed ≥ 10 minutes (never insta-dial)", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 10, 15, 4, 0));
    expect(firstCallDelayMs()).toBe(10 * 60 * 1000);
  });
});

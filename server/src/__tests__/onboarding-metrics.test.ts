import { describe, expect, it } from "vitest";
import { median, summarizeOnboarding } from "../utils/onboarding-metrics";

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);

describe("onboarding-speed medians (T15)", () => {
  it("computes medians only from completed steps", () => {
    const now = new Date();
    const at = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

    const summary = summarizeOnboarding([
      // 2h to source, 4h to first call, 2h source→call
      { signupAt: now, firstLeadSourceConnectedAt: at(2), firstCallAt: at(4) },
      // 6h to source, 10h to call, 4h source→call
      { signupAt: now, firstLeadSourceConnectedAt: at(6), firstCallAt: at(10) },
      // never connected a source / never called — excluded from both medians
      { signupAt: now, firstLeadSourceConnectedAt: null, firstCallAt: null },
      // source connected, no call yet — counts for the first median only
      { signupAt: now, firstLeadSourceConnectedAt: at(1), firstCallAt: null },
    ]);

    expect(summary.clients).toBe(4);
    expect(summary.connectedLeadSource).toBe(3);
    expect(summary.firstCall).toBe(2);
    expect(summary.medianHours.signupToLeadSource).toBe(2);
    expect(summary.medianHours.signupToFirstCall).toBe(7);
    expect(summary.medianHours.leadSourceToFirstCall).toBe(3);
  });

  it("ignores negative gaps and returns null when nothing completed", () => {
    const now = new Date();
    const summary = summarizeOnboarding([
      { signupAt: now, firstLeadSourceConnectedAt: hoursAgo(2), firstCallAt: null },
      { signupAt: now, firstLeadSourceConnectedAt: null, firstCallAt: null },
    ]);
    expect(summary.medianHours.signupToLeadSource).toBeNull();
    expect(summary.medianHours.signupToFirstCall).toBeNull();
    expect(summary.medianHours.leadSourceToFirstCall).toBeNull();
  });

  it("median handles even and odd lengths", () => {
    expect(median([3])).toBe(3);
    expect(median([1, 3])).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBeNull();
  });
});

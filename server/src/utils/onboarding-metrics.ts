/**
 * V2 (T15) — onboarding-speed medians.
 *
 * The admin console answers "how fast does a new broker get live?" from three
 * timestamps on Client: signup, first lead source connected, first call. Rows
 * that never completed a step are excluded from that step's median (counting
 * them as zero would flatter the number); negative gaps are ignored as clock
 * noise.
 */
export interface OnboardingTimestamps {
  signupAt: Date;
  firstLeadSourceConnectedAt: Date | null;
  firstCallAt: Date | null;
}

export interface OnboardingSummary {
  clients: number;
  connectedLeadSource: number;
  firstCall: number;
  medianHours: {
    signupToLeadSource: number | null;
    signupToFirstCall: number | null;
    leadSourceToFirstCall: number | null;
  };
}

const HOURS = 1000 * 60 * 60;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

function gapHours(from: Date, to: Date | null): number | null {
  if (!to) return null;
  const diff = (to.getTime() - from.getTime()) / HOURS;
  return diff >= 0 ? diff : null;
}

export function summarizeOnboarding(rows: OnboardingTimestamps[]): OnboardingSummary {
  const signupToLeadSource: number[] = [];
  const signupToFirstCall: number[] = [];
  const leadSourceToFirstCall: number[] = [];

  for (const row of rows) {
    const toSource = gapHours(row.signupAt, row.firstLeadSourceConnectedAt);
    const toCall = gapHours(row.signupAt, row.firstCallAt);
    if (toSource !== null) signupToLeadSource.push(toSource);
    if (toCall !== null) signupToFirstCall.push(toCall);
    if (row.firstLeadSourceConnectedAt) {
      const sourceToCall = gapHours(row.firstLeadSourceConnectedAt, row.firstCallAt);
      if (sourceToCall !== null) leadSourceToFirstCall.push(sourceToCall);
    }
  }

  return {
    clients: rows.length,
    connectedLeadSource: signupToLeadSource.length,
    firstCall: signupToFirstCall.length,
    medianHours: {
      signupToLeadSource: median(signupToLeadSource),
      signupToFirstCall: median(signupToFirstCall),
      leadSourceToFirstCall: median(leadSourceToFirstCall),
    },
  };
}

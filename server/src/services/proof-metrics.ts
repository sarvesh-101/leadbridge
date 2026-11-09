/**
 * V2 (T11) — Proof engine metric definitions.
 *
 * Pure, deterministic functions so the dashboard, the weekly report and the
 * admin profitability view all compute the SAME numbers from the same inputs.
 *
 * Definitions (V2 doc §T11):
 *   leadsReceived            new non-duplicate leads in the period
 *   medianFirstCallSeconds   median of firstCallDelaySeconds (T5)
 *   reachRate                leads with ≥1 answered call / leads with ≥1 attempt
 *   qualifiedRate            leads with a completed qualification / leads reached
 *   visitsBooked/Completed   from bookings
 *   costPerCompletedVisit    prorated plan price / visitsCompleted ("n/a" if 0)
 */

export interface ProofCallInput {
  status: string;
  createdAt?: Date;
}

export interface ProofLeadInput {
  id: string;
  receivedAt: Date;
  firstCallDelaySeconds?: number | null;
  status: string;
  budget?: string | null;
  location?: string | null;
  propertyType?: string | null;
  timeline?: string | null;
  calls: ProofCallInput[];
}

export interface ProofBookingInput {
  visitDate: Date;
  status: string;
}

export interface ProofPeriod {
  from: Date;
  to: Date;
}

export interface ProofMetrics {
  leadsReceived: number;
  medianFirstCallSeconds: number | null;
  reachRate: number;
  qualifiedRate: number;
  visitsBooked: number;
  visitsCompleted: number;
  costPerCompletedVisit: number | "n/a";
}

const ANSWERED_CALL_STATUSES = new Set(["ANSWERED", "COMPLETED"]);
const ATTEMPTED_CALL_STATUSES = new Set(["INITIATED", "RINGING", "ANSWERED", "COMPLETED", "NO_ANSWER", "FAILED", "BUSY"]);
const QUALIFIED_STATUSES = new Set([
  "BOOKED", "REMINDED", "VISITED", "NO_SHOW", "REBOOKED", "CONVERTED",
  "FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3", "FAQ_ONLY",
]);

export function isQualifiedLead(lead: Pick<ProofLeadInput, "status" | "budget" | "location" | "propertyType" | "timeline">): boolean {
  if (QUALIFIED_STATUSES.has(lead.status)) return true;
  return Boolean(lead.budget || lead.location || lead.propertyType || lead.timeline);
}

export function isReached(lead: ProofLeadInput): boolean {
  return lead.calls.some((c) => ANSWERED_CALL_STATUSES.has(c.status));
}

export function hasAttempt(lead: ProofLeadInput): boolean {
  return lead.calls.some((c) => ATTEMPTED_CALL_STATUSES.has(c.status));
}

/** Median of a numeric list; null for an empty list (never NaN). */
export function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1 ? clean[mid] : Math.round((clean[mid - 1] + clean[mid]) / 2);
}

/** Fraction helper that returns 0 instead of dividing by zero. */
export function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

function daysIn(period: ProofPeriod): number {
  const ms = period.to.getTime() - period.from.getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Compute the proof metrics for one client and one period.
 * `monthlyPlanInclGst` is the GST-inclusive monthly plan charge; the period
 * share is prorated by days (30-day month), matching the doc's "prorated".
 */
export function computeProofMetrics(
  leads: ProofLeadInput[],
  bookings: ProofBookingInput[],
  period: ProofPeriod,
  monthlyPlanInclGst = 0
): ProofMetrics {
  const inPeriod = leads.filter((l) => l.receivedAt >= period.from && l.receivedAt <= period.to);

  const delays = inPeriod
    .map((l) => l.firstCallDelaySeconds)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const reached = inPeriod.filter(isReached);
  const attempted = inPeriod.filter(hasAttempt);
  const qualified = reached.filter(isQualifiedLead);

  const booked = bookings.filter(
    (b) => b.visitDate >= period.from && b.visitDate <= period.to && b.status !== "CANCELLED"
  );
  const completed = bookings.filter(
    (b) => b.visitDate >= period.from && b.visitDate <= period.to && b.status === "VISITED"
  );

  const periodPlanCost = monthlyPlanInclGst > 0 ? (monthlyPlanInclGst * daysIn(period)) / 30 : 0;
  const costPerCompletedVisit =
    completed.length > 0 && periodPlanCost > 0
      ? Math.round(periodPlanCost / completed.length)
      : ("n/a" as const);

  return {
    leadsReceived: inPeriod.length,
    medianFirstCallSeconds: median(delays),
    reachRate: ratio(reached.length, attempted.length),
    qualifiedRate: ratio(qualified.length, reached.length),
    visitsBooked: booked.length,
    visitsCompleted: completed.length,
    costPerCompletedVisit,
  };
}

export interface ProfitabilityInput {
  plan: string;
  planRevenueInclGst: number;
  leadsHandled: number;
  leadsFairUseCapped: number;
  platformCost: number;
}

export interface ProfitabilityRow {
  plan: string;
  avgPlatformCostPerLead: number;
  fairUseCappedShare: number;
  grossMargin: number;
  grossMarginPct: number;
}

/** Admin platform-side profitability per plan (T11). */
export function computeProfitability(rows: ProfitabilityInput[]): ProfitabilityRow[] {
  return rows.map((r) => {
    const avgPlatformCostPerLead = r.leadsHandled > 0 ? Math.round((r.platformCost / r.leadsHandled) * 100) / 100 : 0;
    const grossMargin = Math.round((r.planRevenueInclGst - r.platformCost) * 100) / 100;
    return {
      plan: r.plan,
      avgPlatformCostPerLead,
      fairUseCappedShare: ratio(r.leadsFairUseCapped, r.leadsHandled),
      grossMargin,
      grossMarginPct: r.planRevenueInclGst > 0 ? Math.round((grossMargin / r.planRevenueInclGst) * 1000) / 10 : 0,
    };
  });
}

/** Start of the ISO week (Monday 00:00) for a given instant. */
export function weekStartFor(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  const day = copy.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

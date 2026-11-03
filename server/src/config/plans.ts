/**
 * Plans config — SINGLE SOURCE OF TRUTH for Converza plans, pricing, limits
 * and derivation rules (V2, per docs/V2_DISCOVERY.md §4 and the V2 doc §1.2).
 *
 * Rules:
 *  - ex-GST price is the *display* price ("₹14,999 + 18% GST").
 *  - The amount actually charged (Razorpay plan, Subscription.amount, invoice
 *    total) is the GST-INCLUSIVE figure, rounded to the nearest rupee — this
 *    preserves the existing tax logic in invoice.service.ts (total/1.18).
 *  - Every hardcoded price row found in discovery reads from here.
 *  - Integer rupees everywhere; integer paise at the Razorpay boundary.
 *  - Zero dependencies so both the generator script and the tests can load it.
 */

export type PlanTier = "STARTER" | "GROWTH" | "PRO";

/** 18% GST, SAC 9983 (B2B software). Invoice.service derives the breakdown. */
export const GST_RATE = 0.18;

interface PlanConfig {
  /** Display price, exclusive of GST. */
  monthlyEx: number;
  /** Annual (ex-GST) = 10 × monthly: "12 months for the price of 10". */
  annualEx: number;
  /** Leads handled included per billing month (T2 enforces). */
  leadsPerMonth: number;
  /** Team users included (every paid plan has team access, capped here). */
  teamUsers: number;
  /** Every paid plan ships a dedicated calling number (V2 §1.2). */
  dedicatedNumber: boolean;
  /** Follow-up sequence length in days. */
  followUpDays: number;
  /** Support tier label. */
  support: string;
  /** Fair-use per lead in AI call minutes (T2 enforces; 0 = no cap). */
  fairUseMinutesPerLead: number;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  STARTER: {
    monthlyEx: 14999,
    annualEx: 149990,
    leadsPerMonth: 200,
    teamUsers: 3,
    dedicatedNumber: true,
    followUpDays: 3,
    support: "WhatsApp",
    fairUseMinutesPerLead: 8,
  },
  GROWTH: {
    monthlyEx: 34999,
    annualEx: 349990,
    leadsPerMonth: 600,
    teamUsers: 15,
    dedicatedNumber: true,
    followUpDays: 3,
    support: "Priority",
    fairUseMinutesPerLead: 8,
  },
  PRO: {
    monthlyEx: 59999,
    annualEx: 599990,
    leadsPerMonth: 1200,
    teamUsers: 50,
    dedicatedNumber: true,
    followUpDays: 7,
    support: "Account manager",
    fairUseMinutesPerLead: 8,
  },
};

/**
 * Derived figures (verify in plans-config.test.ts — these exact numbers are
 * pinned by the V2 doc §1.2 table):
 *   STARTER  14,999 → 17,699 incl. · 75/lead · overage 90
 *   GROWTH  34,999 → 41,299 incl. · 58/lead · overage 70
 *   PRO     59,999 → 70,799 incl. · 50/lead · overage 55
 */
export const TIERS = ["STARTER", "GROWTH", "PRO"] as const;

/** Human plan name for a tier. */
export function planDisplayName(tier: PlanTier): string {
  const names: Record<PlanTier, string> = {
    STARTER: "Starter",
    GROWTH: "Growth",
    PRO: "Pro",
  };
  return names[tier];
}

/** Monthly plan allowance for non-price limits (T2 consumes this). */
export function planLeadsPerMonth(tier: PlanTier): number {
  return PLANS[tier].leadsPerMonth;
}

/** GST-inclusive monthly charge, rounded to the nearest rupee. */
export function monthlyCharged(tier: PlanTier): number {
  return Math.round(PLANS[tier].monthlyEx * (1 + GST_RATE));
}

/** GST-inclusive annual charge (10 × monthly ex-GST, then GST), rounded. */
export function annualCharged(tier: PlanTier): number {
  return Math.round(PLANS[tier].annualEx * (1 + GST_RATE));
}

/** Approximate ex-GST price per lead handled (display only). */
export function pricePerLeadEx(tier: PlanTier): number {
  const tierConfig = PLANS[tier];
  return Math.round(tierConfig.monthlyEx / tierConfig.leadsPerMonth);
}

/** Prepaid overage rate per extra lead (ex-GST). */
export const OVERAGE_PER_LEAD_EX: Record<PlanTier, number> = {
  STARTER: 90,
  GROWTH: 70,
  PRO: 55,
};

/**
 * Retired plans (V2 §1.2: "The old Launch plan is retired"). Kept ONLY so
 * existing LAUNCH subscribers keep working until they are mapped to STARTER
 * in T2. Their legacy charged amount must keep matching the Razorpay plan
 * that already exists in the dashboard.
 */
export const RETIRED_PLANS = {
  LAUNCH: {
    mapsTo: "STARTER" as PlanTier,
    /** Kept identical to the existing dashboard Razorpay plan so legacy
     *  subscribers keep charging/billing correctly until T2 maps them. */
    legacyMonthlyCharged: 7999,
    legacyYearlyCharged: 79990,
    legacyUsers: 2,
    legacyLeadsPerMonth: 200,
    legacyCalls: 50,
  },
};

export const TRIAL = {
  days: 30,
  maxLeads: 50,
  /** Per-day ingest cap during trial (abuse guard). */
  maxLeadsPerDay: 25,
};

/** TCCCPR calling window — calls only 09:00–21:00 IST (call-compliance). */
export const CALL_WINDOW = {
  startHour: 9,
  endHour: 21,
  timezone: "Asia/Kolkata",
};

/** Fair-use ceiling: cumulative ANSWERED minutes per lead per billing month. */
export const FAIR_USE_MINUTES_PER_LEAD = 8;

/** Forward-compatible feature gates consumed by the frontend (T3). */
export const FEATURE_GATES = {
  teamAccessOnEveryPaidPlan: true,
  voice: ["GROWTH", "PRO"],
  reports: ["GROWTH", "PRO"],
  email_campaigns: ["PRO"],
  sms_campaigns: ["PRO"],
  ab_testing: ["PRO"],
  api_access: ["PRO"],
} as const;

/** Flat payload shared by GET /api/v1/public/plans and the frontend generator. */
export function buildPlansPayload() {
  return {
    version: 2,
    gstRate: GST_RATE,
    trial: TRIAL,
    fairUseMinutesPerLead: FAIR_USE_MINUTES_PER_LEAD,
    callWindow: CALL_WINDOW,
    plans: TIERS.map((tier) => ({
      id: tier,
      name: planDisplayName(tier),
      monthlyExGst: PLANS[tier].monthlyEx,
      monthlyInclGst: monthlyCharged(tier),
      annualExGst: PLANS[tier].annualEx,
      annualInclGst: annualCharged(tier),
      leadsPerMonth: PLANS[tier].leadsPerMonth,
      teamUsers: PLANS[tier].teamUsers,
      dedicatedNumber: PLANS[tier].dedicatedNumber,
      followUpDays: PLANS[tier].followUpDays,
      support: PLANS[tier].support,
      pricePerLeadExGst: pricePerLeadEx(tier),
      overagePerLeadExGst: OVERAGE_PER_LEAD_EX[tier],
      fairUseMinutesPerLead: PLANS[tier].fairUseMinutesPerLead,
    })),
    retiredPlans: Object.keys(RETIRED_PLANS),
  };
}

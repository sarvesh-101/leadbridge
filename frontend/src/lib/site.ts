/**
 * V2 (T10) — customer-facing site config. Nothing here may be hardcoded in a
 * component; every value comes from env with a safe default.
 */

import { PLANS } from "@/lib/plans.autogen";

const growthPlan = PLANS.plans.find((p) => p.id === "GROWTH");
if (!growthPlan) {
  throw new Error("plans.autogen.ts is missing a GROWTH plan — regenerate from server/src/config/plans.ts");
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://converza.tech";
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.converza.tech";
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@converza.tech";

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Early-access counters render only when the real value reaches this. */
export const STATS_MIN_DISPLAY = int(process.env.NEXT_PUBLIC_STATS_MIN_DISPLAY, 1);

/** Competitor comparison page is hidden until a human verifies every claim. */
export const COMPARE_PAGE_ENABLED = process.env.NEXT_PUBLIC_COMPARE_PAGE_ENABLED === "true";

/** Refund FAQ appears only when the owner supplies the text. */
export const POLICY_REFUND_TEXT = process.env.NEXT_PUBLIC_POLICY_REFUND_TEXT || "";

/** V2 (T10): honest two-telecaller vs Growth cost comparison, derived from plans config.
 * 2 telecallers default ₹50,000/mo; Growth monthly incl. GST minus that. Plain worked example.
 * Any individual broker may do better or worse; this is not a promised saving. */
export const TELE_CALLER_MONTHLY_DEFAULT = 50000;
export const GST_2_PLAN_DIFF = (TELE_CALLER_MONTHLY_DEFAULT - growthPlan.monthlyInclGst);

/** Trust-block slots — hidden until provided. */
export const FOUNDER_NAME = process.env.NEXT_PUBLIC_FOUNDER_NAME || "";
export const FOUNDER_PHOTO = process.env.NEXT_PUBLIC_FOUNDER_PHOTO || "";
export const SAMPLE_CALL_AUDIO = process.env.NEXT_PUBLIC_SAMPLE_CALL_AUDIO || "";

/** The only permitted 24/7 formulation (T9 allow-list). */
export const CAPTURE_LINE = "24/7 lead capture, calls 9 AM to 9 PM IST";

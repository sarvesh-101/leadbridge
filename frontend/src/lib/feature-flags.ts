/**
 * V2 (T16) — scope discipline flags.
 *
 * Features that are NOT sold outside Pro (campaigns, A/B tests, white-label,
 * revenue-recognition tooling) must not be advertised outside the Pro surface.
 * The code stays; only the surface is gated. The Pro line items and /features
 * page still describe them.
 *
 * Default is ON: a missing env var must never hide a shipped Pro feature from a
 * paying broker. Set the var to "false" to hide it deliberately (e.g. while a
 * feature is paused for a cohort).
 *
 * Consumers: `components/shared/Sidebar.tsx` (campaigns nav), and any new
 * campaign/white-label surface should read these rather than inventing another
 * flag.
 */
const flag = (value: string | undefined) => value !== "false";

export const FEATURES = {
  campaigns: flag(process.env.NEXT_PUBLIC_FEATURE_CAMPAIGNS),
  abTests: flag(process.env.NEXT_PUBLIC_FEATURE_AB_TESTS),
  whiteLabel: flag(process.env.NEXT_PUBLIC_FEATURE_WHITE_LABEL),
} as const;

/**
 * Plan Feature Gates — enforces that a client's plan tier grants access to a feature.
 *
 * Usage in a route handler:
 *   const { canAccess } = await import("../../utils/plan-gates");
 *   const { allowed, plan } = await canAccess(fastify.prisma, request.clientId!, "team");
 *   if (!allowed) return reply.status(403).send({
 *     error: `Team features require ${requiredPlan} plan or higher.`,
 *     currentPlan: plan,
 *     upgradeUrl: `${config.FRONTEND_URL}/dashboard/billing`,
 *   });
 */

import { PrismaClient, Plan } from "@prisma/client";
import { config } from "../config";
import { monthlyCharged, RETIRED_PLANS } from "../config/plans";

/**
 * Feature-to-plan mapping.
 * Each feature lists the plan(s) that can access it.
 * Features available to all plans are not listed here.
 */
export const FEATURE_PLANS: Record<string, Plan[]> = {
  // Multi-broker / team — V2 rule (§1.2): EVERY paid plan gets team access,
  // capped by the plan's user count in PLAN_DEFINITIONS.users. This removes
  // the old Launch(2)/Starter(5)-users-but-gated conflict found in discovery.
  team: ["LAUNCH", "STARTER", "GROWTH", "PRO"],

  // AI voice agent configuration
  voice: ["GROWTH", "PRO"],

  // Custom report builder
  reports: ["GROWTH", "PRO"],

  // Email marketing campaigns
  email_campaigns: ["PRO"],

  // SMS marketing campaigns
  sms_campaigns: ["PRO"],

  // A/B testing
  ab_testing: ["PRO"],

  // API access for integrations
  api_access: ["PRO"],
};

/**
 * Human-readable plan display names.
 * T1: charged figures come from config/plans.ts (incl. GST display) —
 * never hardcode rupee amounts here again.
 */
const inr = (n: number) => n.toLocaleString("en-IN");
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  LAUNCH: `Launch (legacy — ₹${inr(RETIRED_PLANS.LAUNCH.legacyMonthlyCharged)}/mo)`,
  STARTER: `Starter (₹${inr(monthlyCharged("STARTER"))}/mo incl. GST)`,
  GROWTH: `Growth (₹${inr(monthlyCharged("GROWTH"))}/mo incl. GST)`,
  PRO: `Pro (₹${inr(monthlyCharged("PRO"))}/mo incl. GST)`,
};

/**
 * Plan tier ordering (higher index = higher tier).
 */
const PLAN_ORDER: Record<string, number> = {
  LAUNCH: 0,
  STARTER: 1,
  GROWTH: 2,
  PRO: 3,
};

/**
 * Check if a client's plan allows access to the given feature.
 *
 * Returns { allowed, plan, requiredPlan } where:
 * - allowed: boolean — whether the client can access the feature
 * - plan: the client's current plan (or "UNKNOWN" if not found)
 * - requiredPlan: the cheapest plan that unlocks this feature
 */
export async function canAccessFeature(
  prisma: PrismaClient,
  clientId: string,
  featureName: string
): Promise<{
  allowed: boolean;
  plan: string;
  requiredPlan: string;
}> {
  // If feature has no plan restriction, allow access
  const requiredPlans = FEATURE_PLANS[featureName];
  if (!requiredPlans || requiredPlans.length === 0) {
    return { allowed: true, plan: "ANY", requiredPlan: "ANY" };
  }

  // Fetch client's current plan
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { plan: true },
  });

  if (!client) {
    return { allowed: false, plan: "UNKNOWN", requiredPlan: requiredPlans[0] };
  }

  const clientPlan = client.plan;
  const clientTier = PLAN_ORDER[clientPlan] ?? -1;

  // Find the cheapest required plan
  const cheapestRequiredTier = Math.min(
    ...requiredPlans.map((p) => PLAN_ORDER[p] ?? 99)
  );
  const cheapestRequiredPlan = Object.entries(PLAN_ORDER).find(
    ([, tier]) => tier === cheapestRequiredTier
  )?.[0] ?? requiredPlans[0];

  const allowed = clientTier >= cheapestRequiredTier;

  return {
    allowed,
    plan: clientPlan,
    requiredPlan: cheapestRequiredPlan,
  };
}

/**
 * Build a standard 403 error response for a feature gate rejection.
 */
export function featureGateError(
  featureDisplayName: string,
  plan: string,
  requiredPlan: string
): { error: string; currentPlan: string; upgradeUrl: string } {
  const planLabel = PLAN_DISPLAY_NAMES[requiredPlan] || `${requiredPlan} plan`;
  const currentPlanLabel = PLAN_DISPLAY_NAMES[plan] || plan || "Free Trial";
  return {
    error: `${featureDisplayName} requires ${planLabel} or higher.`,
    currentPlan: currentPlanLabel,
    upgradeUrl: `${config.FRONTEND_URL}/dashboard/billing`,
  };
}

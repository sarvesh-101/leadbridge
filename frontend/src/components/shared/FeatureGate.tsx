"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Lock, ChevronRight, Crown } from "lucide-react";
import Link from "next/link";

interface FeatureGateProps {
  /** Current user's plan */
  currentPlan?: string;
  /** Required plan for this feature */
  requiredPlan: string;
  /** Name of the feature being gated */
  featureName: string;
  /** Children to render if feature is accessible */
  children: React.ReactNode;
  /** Optional className for the container */
  className?: string;
  /** Optional fallback to show instead of the upgrade prompt */
  fallback?: React.ReactNode;
  /** Optional custom upgrade message */
  upgradeMessage?: string;
  /** Show as a card (with border/rounded) instead of inline */
  card?: boolean;
}

const PLAN_ORDER: Record<string, number> = {
  LAUNCH: 0,
  STARTER: 1,
  GROWTH: 2,
  PRO: 3,
};

const PLAN_NAMES: Record<string, string> = {
  LAUNCH: "Launch",
  STARTER: "Starter",
  GROWTH: "Growth",
  PRO: "Pro",
};

const PLAN_PRICES: Record<string, string> = {
  LAUNCH: "₹8K/mo",
  STARTER: "₹18K/mo",
  GROWTH: "₹35K/mo",
  PRO: "₹60K/mo",
};

export function canAccessFeature(
  currentPlan: string | undefined,
  requiredPlan: string
): boolean {
  const current = PLAN_ORDER[currentPlan || "STARTER"] ?? 0;
  const required = PLAN_ORDER[requiredPlan] ?? 99;
  return current >= required;
}

export function FeatureGate({
  currentPlan,
  requiredPlan,
  featureName,
  children,
  className,
  fallback,
  upgradeMessage,
  card = false,
}: FeatureGateProps) {
  const canAccess = canAccessFeature(currentPlan, requiredPlan);

  if (canAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const requiredPlanName = PLAN_NAMES[requiredPlan] || requiredPlan;
  const requiredPrice = PLAN_PRICES[requiredPlan] || "";
  const currentPlanName = PLAN_NAMES[currentPlan || "STARTER"] || "Free Trial";

  const content = (
    <div className={cn(
      "relative group",
      card && "p-6 rounded-2xl bg-white/[0.03] border border-dashed border-line hover:bg-white/[0.03] transition-all",
      className
    )}>
      {/* Lock overlay */}
      <div className={cn(
        "flex flex-col items-center justify-center text-center py-8 px-4",
        !card && "p-6 rounded-2xl bg-white/[0.03] border border-dashed border-line"
      )}>
        <div className="w-12 h-12 rounded-2xl bg-neutral-soft/10 border border-line/20 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-ink-soft" />
        </div>
        <h3 className="text-base font-semibold text-ink mb-1">
          {upgradeMessage || `${featureName} is a ${requiredPlanName} feature`}
        </h3>
        <p className="text-sm text-ink-soft mb-4 max-w-sm">
          {currentPlan === "STARTER"
            ? `Upgrade to ${requiredPlanName} (${requiredPrice}) or higher to unlock ${featureName}.`
            : currentPlan && PLAN_ORDER[currentPlan] < PLAN_ORDER[requiredPlan]
            ? `Your current plan (${currentPlanName}) doesn't include ${featureName}. Upgrade to ${requiredPlanName} to access this feature.`
            : `Upgrade to ${requiredPlanName} (${requiredPrice}) to unlock ${featureName}.`
          }
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 transition-all"
        >
          <Crown className="w-4 h-4" />
          Upgrade Now
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );

  if (card) {
    return content;
  }

  return content;
}

/**
 * FeatureGateCard — A compact card showing a locked feature with upgrade prompt.
 * Use this for sidebars or settings pages.
 */
export function FeatureGateCard({
  featureName,
  requiredPlan,
  currentPlan,
  description,
}: {
  featureName: string;
  requiredPlan: string;
  currentPlan?: string;
  description?: string;
}) {
  const canAccess = canAccessFeature(currentPlan, requiredPlan);

  if (canAccess) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-4 rounded-xl bg-warning/5 border border-warning/20"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium text-warning">
            {description || `${featureName} locked`}
          </p>
          <p className="text-xs text-warning/70 mt-0.5">
            Available on {PLAN_NAMES[requiredPlan] || requiredPlan} plan ({PLAN_PRICES[requiredPlan] || ""})
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/billing"
        className="shrink-0 px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-all whitespace-nowrap"
      >
        Upgrade
      </Link>
    </motion.div>
  );
}

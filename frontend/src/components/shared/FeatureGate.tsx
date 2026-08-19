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
  STARTER: 0,
  GROWTH: 1,
  PRO: 2,
};

const PLAN_NAMES: Record<string, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  PRO: "Pro",
};

const PLAN_PRICES: Record<string, string> = {
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
      card && "p-6 rounded-2xl bg-white/[0.03] border border-dashed border-white/10 hover:bg-white/[0.03] transition-all",
      className
    )}>
      {/* Lock overlay */}
      <div className={cn(
        "flex flex-col items-center justify-center text-center py-8 px-4",
        !card && "p-6 rounded-2xl bg-white/[0.03] border border-dashed border-white/10"
      )}>
        <div className="w-12 h-12 rounded-2xl bg-gray-500/10 border border-gray-500/20 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-[#9FB0A6]" />
        </div>
        <h3 className="text-base font-semibold text-[#F0F7F3] mb-1">
          {upgradeMessage || `${featureName} is a ${requiredPlanName} feature`}
        </h3>
        <p className="text-sm text-[#9FB0A6] mb-4 max-w-sm">
          {currentPlan === "STARTER"
            ? `Upgrade to ${requiredPlanName} (${requiredPrice}) or higher to unlock ${featureName}.`
            : currentPlan && PLAN_ORDER[currentPlan] < PLAN_ORDER[requiredPlan]
            ? `Your current plan (${currentPlanName}) doesn't include ${featureName}. Upgrade to ${requiredPlanName} to access this feature.`
            : `Upgrade to ${requiredPlanName} (${requiredPrice}) to unlock ${featureName}.`
          }
        </p>
        <Link
          href="/dashboard/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-sm font-medium hover:opacity-90 transition-all"
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
      className="flex items-center justify-between p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-amber-200">
            {description || `${featureName} locked`}
          </p>
          <p className="text-xs text-amber-400/70 mt-0.5">
            Available on {PLAN_NAMES[requiredPlan] || requiredPlan} plan ({PLAN_PRICES[requiredPlan] || ""})
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/billing"
        className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-all whitespace-nowrap"
      >
        Upgrade
      </Link>
    </motion.div>
  );
}

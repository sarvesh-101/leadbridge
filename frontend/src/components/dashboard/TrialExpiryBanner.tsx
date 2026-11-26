"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, X, Zap, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TrialExpiryBannerProps {
  trialEndsAt?: string | null;
  planStatus?: string;
  className?: string;
}

export function TrialExpiryBanner({ trialEndsAt, planStatus, className }: TrialExpiryBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (trialEndsAt) {
      const now = new Date();
      const end = new Date(trialEndsAt);
      const diffMs = end.getTime() - now.getTime();
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      setDaysRemaining(days);
    }
  }, [trialEndsAt]);

  // Only show for trial accounts that haven't expired yet
  if (dismissed || planStatus !== "TRIAL" || daysRemaining === null || daysRemaining <= 0) {
    return null;
  }

  const isUrgent = daysRemaining <= 3;
  const isWarning = daysRemaining <= 7 && !isUrgent;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -12, height: 0 }}
        className={cn(
          "relative overflow-hidden rounded-xl border p-4",
          isUrgent
            ? "bg-danger/10 border-danger/30"
            : isWarning
            ? "bg-warning/10 border-warning/30"
            : "bg-blue-500/10 border-blue-500/30",
          className
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
            isUrgent ? "bg-danger/20" : isWarning ? "bg-warning/20" : "bg-blue-500/20"
          )}>
            {isUrgent ? (
              <Zap className="w-4 h-4 text-danger" />
            ) : (
              <Clock className="w-4 h-4 text-warning" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-sm font-semibold",
              isUrgent ? "text-danger" : isWarning ? "text-warning" : "text-blue-300"
            )}>
              {isUrgent
                ? `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}!`
                : `You're on a free trial — ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`
              }
            </p>
            <p className="text-xs text-ink-muted mt-1">
              {isUrgent
                ? "Upgrade now to keep your leads, calls, and campaigns running without interruption."
                : "Upgrade to a paid plan for more AI calls, advanced campaigns, and priority support."
              }
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link
                href="/dashboard/billing"
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                  isUrgent
                    ? "bg-danger/20 text-danger hover:bg-danger/30"
                    : "bg-gradient-to-r from-line-subtle to-brand-soft text-canvas-deep hover:opacity-90"
                )}
              >
                {isUrgent ? "Upgrade Now" : "View Plans"}
                <ArrowRight className="w-3 h-3" />
              </Link>
              {!isUrgent && (
                <span className="text-xs text-ink-soft">
                  No credit card required
                </span>
              )}
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 p-1 rounded-md hover:bg-surface text-ink-muted hover:text-ink-muted transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: string;
  loading?: boolean;
}

export function StatCard({ title, value, subtitle, icon, trend, color, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-lg app-card p-5 animate-pulse">
        <div className="h-4 w-20 bg-white/[0.06] rounded mb-3" />
        <div className="h-8 w-24 bg-white/[0.06] rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg app-card app-card-hover p-5",
        "hover:border-brand/40 hover:shadow-[0_0_20px_-4px_rgba(242,140,69,0.3)] transition-all duration-200"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="caption mb-1.5">{title}</p>
          <p className="text-[28px] font-display font-bold text-ink leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="text-[12px] text-ink-soft mt-1.5">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg p-2.5 flex-shrink-0",
            color || "bg-brand/15"
          )}
        >
          <div className={cn("w-5 h-5", color ? "text-ink" : "text-brand")}>
            {icon}
          </div>
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-line">
          {trend.positive ? (
            <TrendingUp className="w-3.5 h-3.5 text-brand" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-danger" />
          )}
          <span
            className={cn(
              "text-[12px] font-medium",
              trend.positive ? "text-brand" : "text-danger"
            )}
          >
            {trend.value}%
          </span>
          <span className="text-[12px] text-ink-soft">vs last month</span>
        </div>
      )}
    </motion.div>
  );
}

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
      <div className="rounded-lg bg-[#14161C] border border-[#272B34] p-5 animate-pulse">
        <div className="h-4 w-20 bg-[#1B1E26] rounded mb-3" />
        <div className="h-8 w-24 bg-[#1B1E26] rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg bg-[#14161C] border border-[#272B34] p-5",
        "hover:border-[#3B82F6]/30 hover:shadow-[0_0_16px_#3B82F620] transition-all duration-200"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="caption mb-1.5">{title}</p>
          <p className="text-[28px] font-display font-bold text-[#F2F4F8] leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="text-[12px] text-[#8B93A3] mt-1.5">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg p-2.5 flex-shrink-0",
            color || "bg-[#3B82F6]/10"
          )}
        >
          <div className={cn("w-5 h-5", color ? "text-white" : "text-[#3B82F6]")}>
            {icon}
          </div>
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[#272B34]">
          {trend.positive ? (
            <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-[#F43F5E]" />
          )}
          <span
            className={cn(
              "text-[12px] font-medium",
              trend.positive ? "text-[#10B981]" : "text-[#F43F5E]"
            )}
          >
            {trend.value}%
          </span>
          <span className="text-[12px] text-[#8B93A3]">vs last month</span>
        </div>
      )}
    </motion.div>
  );
}

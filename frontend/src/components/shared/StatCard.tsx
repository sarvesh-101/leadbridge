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
      <div className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-5 animate-pulse">
        <div className="h-4 w-20 bg-[#1A1A24] rounded mb-3" />
        <div className="h-8 w-24 bg-[#1A1A24] rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg bg-[#111118] border border-[#2A2A3A] p-5",
        "hover:border-[#4F6EF7]/30 hover:shadow-[0_0_16px_#4F6EF720] transition-all duration-200"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="caption mb-1.5">{title}</p>
          <p className="text-[28px] font-display font-bold text-[#F0F0F8] leading-none">
            {value}
          </p>
          {subtitle && (
            <p className="text-[12px] text-[#6B6B8A] mt-1.5">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg p-2.5 flex-shrink-0",
            color || "bg-[#4F6EF7]/10"
          )}
        >
          <div className={cn("w-5 h-5", color ? "text-white" : "text-[#4F6EF7]")}>
            {icon}
          </div>
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[#2A2A3A]">
          {trend.positive ? (
            <TrendingUp className="w-3.5 h-3.5 text-[#22D3A5]" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-[#F43F5E]" />
          )}
          <span
            className={cn(
              "text-[12px] font-medium",
              trend.positive ? "text-[#22D3A5]" : "text-[#F43F5E]"
            )}
          >
            {trend.value}%
          </span>
          <span className="text-[12px] text-[#6B6B8A]">vs last month</span>
        </div>
      )}
    </motion.div>
  );
}

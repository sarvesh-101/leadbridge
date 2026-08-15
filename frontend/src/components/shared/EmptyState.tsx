"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-[#1B1E26] border border-[#272B34] flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-[#363B45]" />
        </div>
      )}
      <p className="text-[14px] font-medium text-[#8B93A3]">{title}</p>
      {description && (
        <p className="text-[13px] text-[#363B45] mt-1 text-center max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-[#3B82F6] text-white text-[13px] font-medium hover:brightness-110 transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

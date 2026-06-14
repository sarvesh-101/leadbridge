"use client";

import { LEAD_STATUS_COLORS, LEAD_STATUS_LABELS, type LeadStatus } from "../../types";
import { cn } from "../../lib/utils";

interface LeadStatusBadgeProps {
  status: LeadStatus;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

export function LeadStatusBadge({ status, size = "md", pulse }: LeadStatusBadgeProps) {
  const colorClass = LEAD_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
  const label = LEAD_STATUS_LABELS[status] || status;

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        sizeClasses[size],
        colorClass,
        pulse && "animate-pulse"
      )}
    >
      {status === "CALLING" && (
        <span className="mr-1.5 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
      )}
      {status === "CALLING" && <span className="sr-only">Calling in progress</span>}
      {label}
    </span>
  );
}

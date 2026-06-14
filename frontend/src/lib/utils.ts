import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    scheduled: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30",
    confirmed: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30",
    visited: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/30",
    cancelled: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30",
    completed: "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/30",
    no_show: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30",
  };
  return colors[status] || "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/30";
}

export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return "—";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 12) return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  return phone;
}

export function formatCurrency(budget: string | undefined | null): string {
  if (!budget) return "—";
  const map: Record<string, string> = {
    "under-50L": "< ₹50L",
    "50L-1Cr": "₹50L–1Cr",
    "1Cr-2Cr": "₹1Cr–2Cr",
    "above-2Cr": "> ₹2Cr",
    "not-specified": "Not specified",
  };
  return map[budget] || budget;
}

export function getSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    "99acres": "🏢",
    magicbricks: "🧱",
    housing: "🏠",
    justdial: "📞",
    manual: "✍️",
    facebook: "📘",
    google: "🅖",
    whatsapp: "💬",
    referral: "🤝",
    website: "🌐",
  };
  return icons[source] || "📋";
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500 dark:text-gray-400";
}

export function getScoreBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-gray-400";
}

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Activity, LogIn, Calendar, XCircle, CheckCircle2, RefreshCw,
  MessageSquare, Bot, User, Lock, Filter, Loader2,
  AlertTriangle,
} from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

interface WhatsAppMessage {
  id: string;
  type: string;
  channel: string;
  message: string;
  status: string;
  sentAt: string;
}

interface ActivityData {
  customerLogins: AuditEntry[];
  bookingActions: AuditEntry[];
  allActivity: AuditEntry[];
  whatsappMessages: WhatsAppMessage[];
  ownerNotifications: { id: string; type: string; message: string; status: string; sentAt: string }[];
}

type ActivityFilter = "all" | "login" | "booking" | "whatsapp";

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  "customer.otp.verify.success": { label: "Logged into portal", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: LogIn },
  "customer.booking.confirmed": { label: "Confirmed visit", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  "customer.booking.cancelled": { label: "Cancelled visit", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
  "customer.booking.rescheduled": { label: "Rescheduled visit", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Calendar },
};

const WHATSAPP_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  CHATBOT_REPLY: { label: "AI Assistant", icon: Bot },
  INCOMING_WHATSAPP: { label: "Customer", icon: User },
  OTP_SENT: { label: "OTP", icon: Lock },
};

export function CustomerActivityPanel({ leadId }: { leadId: string }) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>("all");

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function loadActivity() {
    setLoading(true);
    try {
      const res = await api.get(`/customer-activity/${leadId}`);
      setData(res);
    } catch (err) {
      console.error("[CustomerActivityPanel] Failed to load:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function fmt(d: string | undefined | null) {
    if (!d) return "";
    try {
      const date = new Date(d);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-IN", {
        day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function formatDateFull(d: string) {
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        weekday: "short", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return d; }
  }

  /** Display today/yesterday/date for section headers */
  function formatSectionDate(d: string): string {
    const date = new Date(d);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  // Build combined timeline
  const auditTimeline = (data?.allActivity || []).map((e) => ({
    id: e.id,
    type: "audit" as const,
    action: e.action,
    date: e.createdAt,
    changes: e.changes,
  }));

  const whatsappTimeline = (data?.whatsappMessages || []).map((m) => ({
    id: m.id,
    type: "whatsapp" as const,
    action: m.type,
    date: m.sentAt,
    message: m.message,
    status: m.status,
  }));

  const ownerTimeline = (data?.ownerNotifications || []).map((n) => ({
    id: n.id,
    type: "notification" as const,
    action: n.type,
    date: n.sentAt,
    message: n.message,
    status: n.status,
  }));

  let combined = [...auditTimeline, ...whatsappTimeline, ...ownerTimeline]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Apply filter
  if (filter === "login") {
    combined = combined.filter((i) => i.type === "audit" && i.action === "customer.otp.verify.success");
  } else if (filter === "booking") {
    combined = combined.filter((i) => i.type === "audit" && i.action.startsWith("customer.booking."));
  } else if (filter === "whatsapp") {
    combined = combined.filter((i) => i.type === "whatsapp");
  }

  const stats = data ? {
    totalLogins: data.customerLogins.length,
    totalBookingActions: data.bookingActions.length,
    totalWhatsApp: data.whatsappMessages.length,
    totalNotified: data.ownerNotifications.length,
  } : null;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 h-12 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-white/10 rounded" />
                <div className="h-3 w-48 bg-white/5 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
            <div className="text-lg font-bold text-blue-400">{stats.totalLogins}</div>
            <div className="text-[10px] text-gray-500">Logins</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
            <div className="text-lg font-bold text-amber-400">{stats.totalBookingActions}</div>
            <div className="text-[10px] text-gray-500">Actions</div>
          </div>
          <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-center">
            <div className="text-lg font-bold text-green-400">{stats.totalWhatsApp}</div>
            <div className="text-[10px] text-gray-500">WhatsApp</div>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center">
            <div className="text-lg font-bold text-purple-400">{stats.totalNotified}</div>
            <div className="text-[10px] text-gray-500">Notified</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "all" as ActivityFilter, label: "All Activity" },
          { id: "login" as ActivityFilter, label: "Logins" },
          { id: "booking" as ActivityFilter, label: "Bookings" },
          { id: "whatsapp" as ActivityFilter, label: "WhatsApp" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all",
              filter === f.id
                ? "bg-[#4F6EF7] text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
        <button onClick={loadActivity} className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Activity Feed */}
      {combined.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No activity recorded yet</p>
          <p className="text-xs text-gray-600 mt-1">
            Customer portal actions and WhatsApp messages will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence mode="popLayout">
            {combined.slice(0, 50).map((item, i) => (
              <motion.div
                key={item.id + item.date}
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: Math.min(i * 0.015, 0.3) }}
              >
                {item.type === "audit" ? (
                  <AuditItem item={item} fmt={fmt} formatDateFull={formatDateFull} />
                ) : item.type === "whatsapp" ? (
                  <WhatsAppItem item={item} fmt={fmt} formatDateFull={formatDateFull} />
                ) : (
                  <NotificationItem item={item} fmt={fmt} formatDateFull={formatDateFull} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {combined.length > 50 && (
            <p className="text-center text-xs text-gray-600 pt-2">
              Showing 50 of {combined.length} events
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────── */

function AuditItem({ item, fmt, formatDateFull }: {
  item: { action: string; changes?: Record<string, unknown>; date: string };
  fmt: (d: string | undefined | null) => string;
  formatDateFull: (d: string) => string;
}) {
  const Config = ACTION_CONFIG[item.action];
  const Icon = Config?.icon || Activity;
  const label = Config?.label || item.action.replace("customer.", "").replace(/\./g, " ");
  const changes = item.changes;
  const hasDetails = changes && Object.keys(changes).length > 0;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        Config?.color || "bg-white/5"
      )}>
        <Icon className={cn("w-4 h-4", Config?.color?.split(" ")[0] || "text-gray-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white">{label}</p>
          <span className="text-[10px] text-gray-600 shrink-0 group-hover:text-gray-500 transition-colors">
            {fmt(item.date)}
          </span>
        </div>
        {hasDetails && (
          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
            {changes?.leadName ? `${changes.leadName} — ` : ""}
            {changes?.newDate ? `Rescheduled to ${changes.newDate} at ${changes.newTime}` : ""}
            {changes?.reason ? `Reason: ${changes.reason}` : ""}
            {changes?.visitDate ? `Visit: ${changes.visitDate} at ${changes.visitTime}` : ""}
          </p>
        )}
        <p className="text-[9px] text-gray-700 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatDateFull(item.date)}
        </p>
      </div>
    </div>
  );
}

function WhatsAppItem({ item, fmt, formatDateFull }: {
  item: { action: string; message?: string; status?: string; date: string };
  fmt: (d: string | undefined | null) => string;
  formatDateFull: (d: string) => string;
}) {
  const Config = WHATSAPP_TYPE_CONFIG[item.action] || { label: "Message", icon: MessageSquare };
  const Icon = Config.icon;
  const isBot = item.action === "CHATBOT_REPLY";
  const isIncoming = item.action === "INCOMING_WHATSAPP";

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
        isBot ? "bg-[#22D3A5]/10" : isIncoming ? "bg-[#4F6EF7]/10" : "bg-white/5"
      )}>
        <Icon className={cn(
          "w-4 h-4",
          isBot ? "text-[#22D3A5]" : isIncoming ? "text-[#4F6EF7]" : "text-gray-400"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white">{Config.label}</p>
          <span className="text-[10px] text-gray-600 shrink-0">{fmt(item.date)}</span>
        </div>
        {item.message && (
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{item.message}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-gray-700">{formatDateFull(item.date)}</span>
          {item.status && (
            <span className={cn(
              "text-[9px] px-1 rounded",
              item.status === "sent" || item.status === "delivered"
                ? "text-green-500/60"
                : "text-red-500/60"
            )}>
              {item.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationItem({ item, fmt, formatDateFull }: {
  item: { action: string; message?: string; status?: string; date: string };
  fmt: (d: string | undefined | null) => string;
  formatDateFull: (d: string) => string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-white">{item.action.replace(/_/g, " ")}</p>
          <span className="text-[10px] text-gray-600 shrink-0">{fmt(item.date)}</span>
        </div>
        {item.message && (
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{item.message}</p>
        )}
      </div>
    </div>
  );
}

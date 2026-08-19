"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Bell, X, CheckCheck, Calendar, Phone, MessageSquare,
  UserCheck, AlertTriangle, TrendingUp, Zap, Clock,
  Loader2, Megaphone,
} from "lucide-react";

interface OwnerNotification {
  id: string;
  leadId: string | null;
  bookingId: string | null;
  type: string;
  message: string;
  status: string;
  sentAt: string;
  readAt: string | null;
}

const NOTIF_ICONS: Record<string, React.ElementType> = {
  BOOKING_CONFIRMED: Calendar,
  BOOKING_RESCHEDULED: Calendar,
  BOOKING_CANCELLED: X,
  NO_SHOW_ALERT: AlertTriangle,
  BOOKING_DAY_STATUS: Clock,
  FOLLOWUP_D1_SENT: MessageSquare,
  FOLLOWUP_D2_SENT: MessageSquare,
  FOLLOWUP_D3_SENT: MessageSquare,
  COLD_LEAD: AlertTriangle,
  CONVERTED: TrendingUp,
  LEAD_NEW: Zap,
};

const NOTIF_COLORS: Record<string, string> = {
  BOOKING_CONFIRMED: "text-green-400 bg-green-500/10",
  BOOKING_RESCHEDULED: "text-blue-400 bg-blue-500/10",
  BOOKING_CANCELLED: "text-red-400 bg-red-500/10",
  NO_SHOW_ALERT: "text-rose-400 bg-rose-500/10",
  BOOKING_DAY_STATUS: "text-amber-400 bg-amber-500/10",
  FOLLOWUP_D1_SENT: "text-purple-400 bg-purple-500/10",
  FOLLOWUP_D2_SENT: "text-purple-400 bg-purple-500/10",
  FOLLOWUP_D3_SENT: "text-purple-400 bg-purple-500/10",
  COLD_LEAD: "text-[#9FB0A6] bg-gray-500/10",
  CONVERTED: "text-emerald-400 bg-emerald-500/10",
  LEAD_NEW: "text-[#6FE3B0] bg-[#34D399]/15",
};

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.get("/notifications?limit=20");
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Silent — notification loading shouldn't disrupt UX
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const data = await api.get("/notifications/unread-count");
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }, []);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Poll for unread count every 15 seconds
  useEffect(() => {
    const interval = setInterval(loadUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  async function handleOpen() {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setLoading(true);
      await loadNotifications();
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  }

  function getIcon(type: string) {
    const Icon = NOTIF_ICONS[type] || Bell;
    return Icon;
  }

  function getColor(type: string) {
    return NOTIF_COLORS[type] || "text-[#9FB0A6] bg-gray-500/10";
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-4 h-4 text-[#9FB0A6]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-[#FB7185] text-white text-[9px] font-bold px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] rounded-xl border border-white/10 bg-[#101713] shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-[13px] font-semibold text-[#F0F7F3]">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-[11px] text-[#9FB0A6] font-normal">
                    ({unreadCount} unread)
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-[11px] text-[#6FE3B0] hover:text-[#2D6A4F] transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  {markingAll ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3 h-3" />
                  )}
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#101713]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 bg-[#101713] rounded w-3/4" />
                        <div className="h-2.5 bg-[#101713] rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length > 0 ? (
                notifications.map((notif) => {
                  const Icon = getIcon(notif.type);
                  const colorClass = getColor(notif.type);
                  const isUnread = !notif.readAt;

                  return (
                    <button
                      key={notif.id}
                      onClick={() => {
                        if (isUnread) handleMarkRead(notif.id);
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.06] transition-colors border-b border-white/10/50 last:border-0",
                        isUnread && "bg-[#1B4332]/[0.03]"
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-[12px] leading-relaxed",
                          isUnread ? "text-[#F0F7F3] font-medium" : "text-[#9FB0A6]"
                        )}>
                          {notif.message.length > 120
                            ? notif.message.substring(0, 120) + "..."
                            : notif.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[#6B7C73]">{formatDate(notif.sentAt)}</span>
                          {notif.status === "failed" && (
                            <span className="text-[10px] text-red-400/60">Failed to send</span>
                          )}
                          {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1B4332]" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-[#6B7C73] mx-auto mb-2" />
                  <p className="text-[13px] text-[#9FB0A6]">No notifications yet</p>
                  <p className="text-[11px] text-[#6B7C73] mt-1">
                    Updates about leads, bookings, and calls will appear here
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

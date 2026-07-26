"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Clock, MapPin, ArrowLeft, RefreshCw, CheckCircle2,
  XCircle, Loader2, Home, IndianRupee, Bed, ChevronRight, MessageSquare,
} from "lucide-react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

interface PropertyMini {
  name: string;
  price?: number;
  bedrooms?: number;
  images?: string[];
}

interface BookingEntry {
  id: string;
  visitDate: string;
  visitTime: string;
  propertyAddress: string;
  propertyName?: string;
  status: string;
  notes?: string;
  confirmedAt?: string;
  visitedAt?: string;
  noShowAt?: string;
  property?: PropertyMini | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED: { label: "Confirmed", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  REMINDED: { label: "Reminder Sent", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  VISITED: { label: "Visited", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  NO_SHOW: { label: "Missed", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  RESCHEDULED: { label: "Rescheduled", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  CANCELLED: { label: "Cancelled", color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20" },
};

export default function CustomerBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const token = sessionStorage.getItem("customer_token");
    if (!token) {
      router.push("/customer/login");
      return;
    }
    loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBookings() {
    const token = sessionStorage.getItem("customer_token");
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customer/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.clear();
          router.push("/customer/login");
          return;
        }
        throw new Error("Failed to load bookings");
      }

      const data = await res.json();
      setBookings(data.bookings || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(bookingId: string) {
    setConfirmingId(bookingId);
    try {
      const token = sessionStorage.getItem("customer_token");
      const res = await fetch(`${API_BASE}/customer/bookings/${bookingId}/confirm`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to confirm");
      }

      toast.success("Visit confirmed! We look forward to seeing you.");
      await loadBookings();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm");
    } finally {
      setConfirmingId(null);
    }
  }

  const filtered = filter === "all"
    ? bookings
    : bookings.filter((b) => b.status === filter);

  const sorted = [...filtered].sort((a, b) => {
    // Active bookings first, then by date desc
    const activeStatuses = ["CONFIRMED", "REMINDED", "RESCHEDULED"];
    const aActive = activeStatuses.includes(a.status) ? 0 : 1;
    const bActive = activeStatuses.includes(b.status) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
  });

  const activeCount = bookings.filter((b) =>
    ["CONFIRMED", "REMINDED", "RESCHEDULED"].includes(b.status)
  ).length;

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  }

  function isPastBooking(booking: BookingEntry) {
    const visitDate = new Date(booking.visitDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return visitDate < today;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/customer/dashboard")} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">Booking History</h1>
            <p className="text-[10px] text-gray-500">Your property visits</p>
          </div>
          <button onClick={loadBookings} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
            <div className="text-lg font-bold text-white">{bookings.length}</div>
            <div className="text-[10px] text-gray-500">Total</div>
          </div>
          <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-center">
            <div className="text-lg font-bold text-green-400">{activeCount}</div>
            <div className="text-[10px] text-gray-500">Active</div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
            <div className="text-lg font-bold text-emerald-400">
              {bookings.filter((b) => b.status === "VISITED").length}
            </div>
            <div className="text-[10px] text-gray-500">Visited</div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {["all", "CONFIRMED", "REMINDED", "RESCHEDULED", "VISITED", "CANCELLED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all",
                filter === s
                  ? "bg-[#4F6EF7] text-white"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {s === "all" ? "All" : (STATUS_CONFIG[s]?.label || s)}
            </button>
          ))}
        </div>

        {/* Booking List */}
        <ErrorBoundary fallback={
          <div className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
            <p className="text-sm text-red-400">Something went wrong loading your bookings.</p>
            <button onClick={loadBookings} className="mt-3 text-xs text-[#4F6EF7] hover:underline">Try Again</button>
          </div>
        }>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-3 w-48 bg-white/10 rounded" />
                    <div className="flex gap-2 mt-3">
                      <div className="h-3 w-20 bg-white/10 rounded" />
                      <div className="h-3 w-20 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {sorted.map((booking, i) => {
              const statusInfo = STATUS_CONFIG[booking.status] || { label: booking.status, color: "text-gray-400", bg: "bg-white/5 border-white/10" };
              const past = isPastBooking(booking);
              const canConfirm = booking.status === "REMINDED" && !past;
              const needsAction = booking.status === "REMINDED";

              return (
                <motion.div
                  key={booking.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all",
                    needsAction
                      ? "border-amber-500/30 bg-amber-500/5"
                      : statusInfo.bg,
                    !needsAction && "hover:bg-white/[0.07] cursor-default"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Property icon */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      needsAction ? "bg-amber-500/20" : "bg-white/5"
                    )}>
                      <Home className={cn("w-5 h-5", needsAction ? "text-amber-400" : "text-gray-400")} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {booking.propertyName || booking.property?.name || "Property Visit"}
                          </h3>
                          {booking.propertyName && booking.property?.name && (
                            <p className="text-[11px] text-gray-500 truncate">{booking.property.name}</p>
                          )}
                        </div>
                        <span className={cn(
                          "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border",
                          statusInfo.bg, statusInfo.color
                        )}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* Date, Time, Location */}
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Calendar className="w-3 h-3 text-[#4F6EF7] shrink-0" />
                          {formatDate(booking.visitDate)}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock className="w-3 h-3 text-[#22D3A5] shrink-0" />
                          {booking.visitTime}
                        </div>
                      </div>

                      <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-2">
                        <MapPin className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{booking.propertyAddress}</span>
                      </div>

                      {/* Property details */}
                      {booking.property?.price && (
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <IndianRupee className="w-3 h-3" />
                            {booking.property.price.toLocaleString("en-IN")}
                          </span>
                          {booking.property?.bedrooms && (
                            <span className="flex items-center gap-1">
                              <Bed className="w-3 h-3" />
                              {booking.property.bedrooms} BHK
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {booking.notes && (
                        <p className="text-[11px] text-gray-600 italic mb-2">{booking.notes}</p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 mt-2">
                        {canConfirm && (
                          <button
                            onClick={() => handleConfirm(booking.id)}
                            disabled={confirmingId === booking.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-[11px] font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
                          >
                            {confirmingId === booking.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Confirm Visit
                          </button>
                        )}
                        {!["VISITED", "CANCELLED", "NO_SHOW"].includes(booking.status) && (
                          <button
                            onClick={() => {
                              sessionStorage.setItem("customer_booking", JSON.stringify(booking));
                              router.push("/customer/dashboard");
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-[11px] hover:bg-white/10 transition-all"
                          >
                            <Calendar className="w-3 h-3" />
                            Manage
                          </button>
                        )}
                        {booking.status === "CANCELLED" && (
                          <span className="text-[10px] text-gray-600">Cancelled</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center"
          >
            <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-white mb-1">No Bookings Found</h2>
            <p className="text-xs text-gray-500 mb-4">
              {filter !== "all"
                ? `No bookings with status "${STATUS_CONFIG[filter]?.label || filter}"`
                : "Your past and upcoming visits will appear here"}
            </p>
            <button onClick={() => router.push("/customer/dashboard")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4F6EF7] text-white text-xs font-medium hover:opacity-90 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
          </motion.div>
        )}
        </ErrorBoundary>
      </main>
    </div>
  );
}

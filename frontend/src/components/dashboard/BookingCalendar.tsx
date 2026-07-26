"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Phone,
  User,
  Plus,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Booking, BookingStatus } from "@/types";
import { api } from "@/lib/api";
import { toast } from "sonner";

/* ─── Constants ────────────────────────────────────────────── */

const STATUS_COLORS: Record<BookingStatus, string> = {
  CONFIRMED: "bg-blue-500",
  REMINDED: "bg-teal-500",
  VISITED: "bg-emerald-500",
  NO_SHOW: "bg-red-500",
  RESCHEDULED: "bg-amber-500",
  CANCELLED: "bg-gray-500",
};

const STATUS_BG: Record<BookingStatus, string> = {
  CONFIRMED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  REMINDED: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  VISITED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  NO_SHOW: "bg-red-500/10 text-red-400 border-red-500/20",
  RESCHEDULED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CANCELLED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Props ─────────────────────────────────────────────────── */

interface BookingCalendarProps {
  bookings: Booking[];
  loading: boolean;
  onRefresh: () => void;
}

/* ─── Main Component ───────────────────────────────────────── */

export default function BookingCalendar({
  bookings,
  loading,
  onRefresh,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);

  // Navigate months
  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToday = () => setCurrentMonth(new Date());

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Group bookings by date
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = format(parseISO(b.visitDate), "yyyy-MM-dd");
      const existing = map.get(key) || [];
      existing.push(b);
      map.set(key, existing);
    }
    return map;
  }, [bookings]);

  // Bookings for selected date
  const selectedBookings = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return bookingsByDate.get(key) || [];
  }, [selectedDate, bookingsByDate]);

  // Handle day click
  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day);
  }, []);

  // Open quick-add for a specific date
  const handleQuickAdd = useCallback((date: Date) => {
    setQuickAddDate(date);
    setShowQuickAdd(true);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ── Calendar Grid ─────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-white min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_HEADERS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium text-gray-500 py-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate.get(key) || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={key}
                  onClick={() => handleDayClick(day)}
                  onDoubleClick={() => handleQuickAdd(day)}
                  className={cn(
                    "relative flex flex-col items-center justify-start pt-1.5 pb-1 rounded-xl transition-all duration-150 min-h-[80px] sm:min-h-[90px] group",
                    isCurrentMonth
                      ? "hover:bg-white/10 cursor-pointer"
                      : "opacity-30 cursor-default",
                    isSelected && "ring-2 ring-leadflow-500/50 bg-white/10",
                    today && !isSelected && "ring-1 ring-leadflow-accent/30"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full",
                      today
                        ? "bg-leadflow-accent text-white"
                        : isCurrentMonth
                        ? "text-gray-300"
                        : "text-gray-600"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Booking dots */}
                  {dayBookings.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 max-w-[60px]">
                      {dayBookings.slice(0, 4).map((b) => (
                        <span
                          key={b.id}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            STATUS_COLORS[b.status] || "bg-gray-500"
                          )}
                          title={`${b.lead?.name || "Unknown"} — ${b.status}`}
                        />
                      ))}
                      {dayBookings.length > 4 && (
                        <span className="text-[9px] text-gray-500 font-medium">
                          +{dayBookings.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quick-add button on hover */}
                  {isCurrentMonth && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAdd(day);
                      }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-leadflow-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/5">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", color)} />
              <span className="text-[11px] text-gray-500 capitalize">
                {status.replace(/_/g, " ")}
              </span>
            </div>
          ))}
          <span className="text-[11px] text-gray-600 ml-auto">
            Double-click a day to quick-add a booking
          </span>
        </div>
      </div>

      {/* ── Side Panel: Selected Day Details ──────────────── */}
      <AnimatePresence mode="wait">
        {selectedDate ? (
          <motion.div
            key={format(selectedDate, "yyyy-MM-dd")}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full lg:w-80 shrink-0"
          >
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              {/* Panel header */}
              <div className="p-4 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {format(selectedDate, "EEEE, MMMM d")}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedBookings.length} booking
                      {selectedBookings.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleQuickAdd(selectedDate)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-leadflow-accent transition-colors"
                      title="Add booking"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Bookings list */}
              <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                {selectedBookings.length === 0 ? (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No bookings on this day</p>
                    <button
                      onClick={() => handleQuickAdd(selectedDate)}
                      className="mt-3 text-xs text-leadflow-accent hover:underline"
                    >
                      Add a booking
                    </button>
                  </div>
                ) : (
                  selectedBookings.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-3 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer group"
                    >
                      {/* Lead name + status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-leadflow-accent" />
                          </div>
                          <span className="text-sm font-medium text-white truncate">
                            {b.lead?.name || "Unknown"}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                            STATUS_BG[b.status]
                          )}
                        >
                          {b.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1 text-xs text-gray-500 ml-9">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {b.visitTime}
                        </div>
                        {b.lead?.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {b.lead.phone}
                          </div>
                        )}
                        {(b.propertyAddress || b.propertyName) && (
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {b.propertyAddress || b.propertyName}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full lg:w-80 shrink-0"
          >
            <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
              <CalendarIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Click a date to see booking details
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Double-click to add a new booking
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick-Add Booking Modal ───────────────────────── */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddModal
            date={quickAddDate || new Date()}
            onClose={() => {
              setShowQuickAdd(false);
              setQuickAddDate(null);
            }}
            onComplete={() => {
              setShowQuickAdd(false);
              setQuickAddDate(null);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Quick-Add Modal ──────────────────────────────────────── */

function QuickAddModal({
  date,
  onClose,
  onComplete,
}: {
  date: Date;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [visitTime, setVisitTime] = useState("11:00");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    setSaving(true);
    try {
      await api.post("/bookings", {
        name: name.trim(),
        phone: phone.trim(),
        visitDate: format(date, "yyyy-MM-dd"),
        visitTime,
        propertyAddress: propertyAddress.trim(),
        notes: notes.trim(),
      });
      toast.success("Booking created");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Failed to create booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
        className="w-full max-w-md rounded-2xl bg-surface border border-white/10 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-base font-semibold text-white">New Booking</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {format(date, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Lead Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-leadflow-500/50 transition-colors"
                autoFocus
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Phone *
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-leadflow-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Time
              </label>
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50 transition-colors [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Status
              </label>
              <div className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                CONFIRMED
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Property Address
            </label>
            <input
              value={propertyAddress}
              onChange={(e) => setPropertyAddress(e.target.value)}
              placeholder="7th floor, Sunrise Tower, Andheri West"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-leadflow-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional info..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-leadflow-500/50 transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !phone.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-leadflow-500 text-white text-sm font-medium hover:bg-leadflow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Create Booking
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

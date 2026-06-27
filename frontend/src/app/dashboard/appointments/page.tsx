"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn, getStatusColor, formatDate, formatPhone } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Download, Calendar as CalendarIcon, Search, Clock, MapPin } from "lucide-react";
import { exportToCSV, EXPORT_HEADERS } from "@/lib/csv-export";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";

export default function AppointmentsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function loadBookings() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (filter !== "all") params.set("status", filter.toUpperCase());
        const data = await api.get(`/bookings?${params}`);
        setBookings(data.bookings || []);
        setTotal(data.total || 0);
      } catch (err) {
        console.error("Failed to load bookings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, [page, filter]);

  const filtered = search
    ? bookings.filter((b: any) =>
        b.lead?.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.lead?.phone?.includes(search) ||
        b.propertyAddress?.toLowerCase().includes(search.toLowerCase())
      )
    : bookings;

  const totalPages = Math.ceil(total / 20);

  // Quick stats
  const todayCount = bookings.filter((b: any) => {
    const today = new Date().toDateString();
    return new Date(b.visitDate).toDateString() === today;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Appointments</h1>
          <p className="text-gray-400 mt-1">Manage and track all property visits</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => {
              exportToCSV(bookings, `bookings-export-${new Date().toISOString().split("T")[0]}`, EXPORT_HEADERS.bookings);
              toast.success(`${bookings.length} bookings exported`);
            }}
            disabled={bookings.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Today", count: todayCount, color: "text-blue-400" },
          { label: "Total", count: total, color: "text-green-400" },
          { label: "Visited", count: bookings.filter((b: any) => b.status === "VISITED").length, color: "text-emerald-400" },
          { label: "No Shows", count: bookings.filter((b: any) => b.status === "NO_SHOW").length, color: "text-red-400" },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10"
          >
            {loading ? (
              <div className="animate-pulse"><div className="h-7 w-12 bg-white/10 rounded" /></div>
            ) : (
              <>
                <div className={cn("text-2xl font-bold text-white", s.color)}>{s.count}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search appointments..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50" />
        </div>
        <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
          <option value="all">All Status</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="REMINDED">Reminded</option>
          <option value="VISITED">Visited</option>
          <option value="NO_SHOW">No Show</option>
          <option value="RESCHEDULED">Rescheduled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((apt: any, i: number) => (
            <motion.div key={apt.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20 flex items-center justify-center flex-shrink-0">
                  <CalendarIcon className="w-5 h-5 text-leadflow-accent" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{apt.lead?.name || "Unknown"}</div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 flex-shrink-0" /> {formatDate(apt.visitDate)} {apt.visitTime}</span>
                    <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 flex-shrink-0" /> {apt.propertyAddress || apt.propertyName || "—"}</span>
                  </div>
                  {apt.lead?.phone && <span className="text-xs text-gray-600 mt-0.5 block">{formatPhone(apt.lead.phone)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", getStatusColor(apt.status.toLowerCase()))}>
                  {apt.status.replace(/_/g, " ")}
                </span>
                <div className="text-xs text-gray-500">Score: {apt.lead?.score || "—"}</div>
              </div>
            </motion.div>
          ))
        ) : (
          <EmptyState
            title={search ? "No appointments match your search" : "No appointments yet"}
            description={search ? "Try a different search term" : "Appointments will appear here when leads book visits"}
          />
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={20}
        onPageChange={setPage}
        loading={loading}
      />
    </div>
  );
}

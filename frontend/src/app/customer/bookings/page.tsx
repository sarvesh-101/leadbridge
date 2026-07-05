"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";import {
  Calendar, Clock, MapPin, ArrowLeft, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

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
  property?: {
    name: string;
    price?: number;
    bedrooms?: number;
    images?: string[];
  };
}

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "border-green-500/20 bg-green-500/5",
  REMINDED: "border-amber-500/20 bg-amber-500/5",
  VISITED: "border-emerald-500/20 bg-emerald-500/5",
  NO_SHOW: "border-red-500/20 bg-red-500/5",
  RESCHEDULED: "border-blue-500/20 bg-blue-500/5",
  CANCELLED: "border-gray-500/20 bg-gray-500/5",
};

export default function CustomerBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      // Load profile which includes current booking
      const res = await fetch(`${API_BASE}/customer/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.clear();
          router.push("/customer/login");
          return;
        }
        throw new Error("Failed to load");
      }

      const data = await res.json();
      // The profile only gives us the current booking
      // We also look for other bookings from session storage
      const currentBooking = data.booking;
      setBookings(currentBooking ? [currentBooking] : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/customer/dashboard")} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white">Booking History</h1>
            <p className="text-[10px] text-gray-500">Your property visits</p>
          </div>
          <button onClick={loadBookings} className="ml-auto p-2 rounded-lg hover:bg-white/5 text-gray-400">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1].map(i => (
              <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10 animate-pulse">
                <div className="h-4 w-24 bg-white/10 rounded mb-3" />
                <div className="h-5 w-48 bg-white/10 rounded mb-2" />
                <div className="h-3 w-32 bg-white/10 rounded mb-4" />
                <div className="flex gap-2">
                  <div className="h-3 w-20 bg-white/10 rounded" />
                  <div className="h-3 w-20 bg-white/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : bookings.length > 0 ? (
          bookings.map((booking, i) => (
            <motion.div key={booking.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`p-5 rounded-2xl border ${STATUS_STYLES[booking.status] || "bg-white/5 border-white/10"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {booking.propertyName || "Property Visit"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{booking.status}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <Calendar className="w-3.5 h-3.5 text-[#4F6EF7]" />
                  <div>
                    <div className="text-xs text-white">{new Date(booking.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                    <div className="text-[10px] text-gray-500">Date</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-[#22D3A5]" />
                  <div>
                    <div className="text-xs text-white">{booking.visitTime}</div>
                    <div className="text-[10px] text-gray-500">Time</div>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
                <MapPin className="w-3.5 h-3.5 text-red-400 mt-0.5" />
                <div>
                  <div className="text-xs text-white">{booking.propertyAddress}</div>
                </div>
              </div>

              {booking.notes && (
                <p className="text-xs text-gray-500 mt-3">{booking.notes}</p>
              )}
            </motion.div>
          ))
        ) : (
          <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Calendar className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-white mb-1">No Booking History</h2>
            <p className="text-xs text-gray-500 mb-4">Your past and upcoming visits will appear here</p>
            <button onClick={() => router.push("/customer/dashboard")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4F6EF7] text-white text-xs font-medium hover:opacity-90 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

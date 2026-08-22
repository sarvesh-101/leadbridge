"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  Calendar, Clock, MapPin,
  IndianRupee, Bed, Bath, Maximize, CheckCircle2, XCircle,
  Loader2, RefreshCw, Zap, MessageSquare,
  ChevronDown, ChevronUp, FileText, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { customerApi, customerFetch } from "@/lib/customer-api";

interface PropertyInfo {
  name: string;
  description?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  areaUnit: string;
  amenities?: string[];
  images?: string[];
  status?: string;
}

interface BookingInfo {
  id: string;
  visitDate: string;
  visitTime: string;
  propertyAddress: string;
  propertyName?: string;
  property?: PropertyInfo | null;
  status: string;
  notes?: string;
  confirmedAt?: string;
  reminderSentAt?: string;
  visitedAt?: string;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  score: number;
  source?: string;
  budget?: string;
  location?: string;
  timeline?: string;
  propertyType?: string;
  clientName: string;
  clientOwner: string;
  clientContact: string;
  clientCity: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  CONFIRMED: { label: "Visit Confirmed", color: "text-green-400 border-green-500/20 bg-green-500/10", icon: CheckCircle2 },
  REMINDED: { label: "Reminder Sent", color: "text-amber-400 border-amber-500/20 bg-amber-500/10", icon: Clock },
  VISITED: { label: "Visited", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10", icon: CheckCircle2 },
  NO_SHOW: { label: "Missed Visit", color: "text-red-400 border-red-500/20 bg-red-500/10", icon: XCircle },
  RESCHEDULED: { label: "Rescheduled", color: "text-blue-400 border-blue-500/20 bg-blue-500/10", icon: Calendar },
  CANCELLED: { label: "Cancelled", color: "text-[#9FB0A6] border-gray-500/20 bg-gray-500/10", icon: XCircle },
};

function BookingCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl app-card animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="space-y-1">
          <div className="h-4 w-20 bg-white/[0.06] rounded" />
          <div className="h-3 w-32 bg-[#101713] rounded" />
        </div>
        <div className="h-6 w-24 bg-white/[0.06] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-[#101713]"><div className="h-4 w-24 bg-white/[0.06] rounded mb-2" /><div className="h-3 w-16 bg-[#101713] rounded" /></div>
        <div className="p-3 rounded-xl bg-[#101713]"><div className="h-4 w-20 bg-white/[0.06] rounded mb-2" /><div className="h-3 w-16 bg-[#101713] rounded" /></div>
      </div>
      <div className="p-3 rounded-xl bg-[#101713]"><div className="h-3 w-full bg-[#101713] rounded" /></div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showAllProperties, setShowAllProperties] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("customer_token");
    if (!token) {
      router.push("/customer/login");
      return;
    }
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    const token = sessionStorage.getItem("customer_token");
    if (!token) return;

    try {
      const data = await customerApi.get("/customer/profile");
      setCustomer(data.customer);
      setBooking(data.booking);

      sessionStorage.setItem("customer_data", JSON.stringify(data.customer));
      if (data.booking) {
        sessionStorage.setItem("customer_booking", JSON.stringify(data.booking));
      }

      try {
        const propData = await customerApi.get("/customer/properties");
        setProperties(propData.properties || []);
      } catch { /* non-critical */ }
    } catch (err: any) {
      toast.error(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleReschedule() {
    if (!newDate || !newTime) return toast.error("Select a new date and time");
    setActionLoading(true);
    try {
      await customerApi.patch(`/customer/bookings/${booking!.id}/reschedule`, { visitDate: newDate, visitTime: newTime });
      toast.success("Visit rescheduled successfully!");
      setShowReschedule(false);
      await loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to reschedule");
    } finally { setActionLoading(false); }
  }

  async function handleConfirm() {
    if (!booking) return;
    setConfirmLoading(true);
    try {
      await customerApi.patch(`/customer/bookings/${booking.id}/confirm`);
      toast.success("Visit confirmed! We look forward to seeing you.");
      await loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm");
    } finally { setConfirmLoading(false); }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await customerApi.patch(`/customer/bookings/${booking!.id}/cancel`, { reason: cancelReason || undefined });
      toast.success("Visit cancelled");
      setShowCancel(false);
      await loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    } finally { setActionLoading(false); }
  }

  function getBookingStatus() {
    if (!booking) return null;
    return STATUS_CONFIG[booking.status] || { label: booking.status, color: "text-[#9FB0A6]", icon: Clock };
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F0C] aurora-backdrop">
        <header className="sticky top-0 z-10 bg-[#0A0F0C]/80 backdrop-blur-lg border-b border-white/10">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="w-24 h-4 bg-white/[0.06] rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </main>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#0A0F0C] aurora-backdrop flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[#9FB0A6] mb-4">Session expired</p>
          <button onClick={() => router.push("/customer/login")}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-sm"
          >
            Login Again
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getBookingStatus();
  const StatusIcon = statusInfo?.icon || Clock;

  return (
    <div className="min-h-screen bg-[#0A0F0C] aurora-backdrop">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0F0C]/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#F0F7F3]">LeadBridge</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadProfile} className="p-2 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => { sessionStorage.clear(); router.push("/customer/login"); }}
              className="text-xs text-[#9FB0A6] hover:text-[#F0F7F3]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* ── Welcome Card ──────────────────────────────────── */}
        <ErrorBoundary fallback={
          <div className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 text-center">
            <p className="text-sm text-[#9FB0A6]">Welcome back! Please refresh the page.</p>
          </div>
        }>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] flex items-center justify-center">
                <span className="text-white text-sm font-bold">{customer.name[0]}</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#F0F7F3]">Namaste, {customer.name}! 👋</h1>
                <p className="text-xs text-[#9FB0A6]">{customer.clientName} — {customer.clientCity}</p>
              </div>
            </div>
            {customer.clientContact && (
              <a href={`https://wa.me/${customer.clientContact.replace(/\D/g, "")}`} target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:underline"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Contact broker on WhatsApp
              </a>
            )}

            <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
              <Link href="/customer/chat"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl app-card app-card-hover text-[#9FB0A6] text-xs hover:bg-white/[0.06] transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp Chat
              </Link>
              <Link href="/customer/bookings"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl app-card app-card-hover text-[#9FB0A6] text-xs hover:bg-white/[0.06] transition-all"
              >
                <History className="w-3.5 h-3.5" />
                Bookings
              </Link>
              <Link href="/customer/documents"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl app-card app-card-hover text-[#9FB0A6] text-xs hover:bg-white/[0.06] transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                Documents
              </Link>
            </div>
          </motion.div>
        </ErrorBoundary>

        {/* ── Booking ───────────────────────────────────────── */}
        {booking ? (
          <ErrorBoundary fallback={
            <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
              <AlertCircleIcon />
              <p className="text-sm text-red-400">Failed to load booking details.</p>
              <button onClick={loadProfile} className="mt-3 text-xs text-[#6FE3B0] hover:underline">
                Try Again
              </button>
            </div>
          }>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="p-5 rounded-2xl app-card"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#F0F7F3] mb-1">Your Visit</h2>
                  <p className="text-xs text-[#9FB0A6]">Property Visit Booking</p>
                </div>
                {statusInfo && (
                  <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl app-card">
                  <Calendar className="w-4 h-4 text-[#6FE3B0] mb-1" />
                  <div className="text-sm font-semibold text-[#F0F7F3]">{formatDate(booking.visitDate)}</div>
                  <div className="text-[11px] text-[#9FB0A6]">Date</div>
                </div>
                <div className="p-3 rounded-xl app-card">
                  <Clock className="w-4 h-4 text-[#34D399] mb-1" />
                  <div className="text-sm font-semibold text-[#F0F7F3]">{booking.visitTime}</div>
                  <div className="text-[11px] text-[#9FB0A6]">Time</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl app-card">
                <MapPin className="w-4 h-4 text-red-400 mt-0.5" />
                <div>
                  <div className="text-sm text-[#F0F7F3]">{booking.propertyAddress}</div>
                  {booking.propertyName && (
                    <div className="text-xs text-[#9FB0A6] mt-0.5">{booking.propertyName}</div>
                  )}
                </div>
              </div>

              {booking.notes && <p className="text-xs text-[#9FB0A6] mt-3">{booking.notes}</p>}

              {!["VISITED", "CANCELLED", "NO_SHOW"].includes(booking.status) && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
                  {booking.status === "REMINDED" && (
                    <button onClick={handleConfirm} disabled={confirmLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-all disabled:opacity-50"
                    >
                      {confirmLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Confirm Visit
                    </button>
                  )}
                  <button onClick={() => { setNewDate(""); setNewTime(""); setShowReschedule(!showReschedule); setShowCancel(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-[#9FB0A6] text-xs hover:bg-white/[0.06] transition-all"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Reschedule
                  </button>
                  <button onClick={() => { setCancelReason(""); setShowCancel(!showCancel); setShowReschedule(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-400 text-xs hover:bg-red-500/5 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Cancel Visit
                  </button>
                </div>
              )}

              {showReschedule && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 pt-4 border-t border-white/10 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#9FB0A6] mb-1 block">New Date</label>
                      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2 rounded-xl app-card text-[#F0F7F3] text-xs focus:outline-none focus:border-[#34D399]/50/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9FB0A6] mb-1 block">New Time</label>
                      <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl app-card text-[#F0F7F3] text-xs focus:outline-none focus:border-[#34D399]/50/50"
                      />
                    </div>
                  </div>
                  <button onClick={handleReschedule} disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-medium hover:opacity-90 transition-all disabled:opacity-40"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Confirm Reschedule
                  </button>
                </motion.div>
              )}

              {showCancel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 pt-4 border-t border-white/10 space-y-3"
                >
                  <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl app-card text-[#F0F7F3] text-xs focus:outline-none"
                  >
                    <option value="">Select a reason...</option>
                    <option value="Not interested anymore">Not interested anymore</option>
                    <option value="Found another property">Found another property</option>
                    <option value="Timing doesn't work">Timing doesn&apos;t work</option>
                    <option value="Too far / location issue">Too far / location issue</option>
                    <option value="Already purchased">Already purchased</option>
                    <option value="Other">Other</option>
                  </select>
                  <button onClick={handleCancel} disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-all disabled:opacity-40"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Confirm Cancellation
                  </button>
                </motion.div>
              )}
            </motion.div>
          </ErrorBoundary>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-2xl app-card text-center"
          >
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[#F0F7F3] mb-1">No Active Bookings</h2>
            <p className="text-sm text-[#9FB0A6] mb-4">
              You don&apos;t have any upcoming visits scheduled. Contact your broker on WhatsApp.
            </p>
            {customer.clientContact && (
              <a href={`https://wa.me/${customer.clientContact.replace(/\D/g, "")}`} target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20 transition-all"
              >
                <MessageSquare className="w-4 h-4" /> Contact {customer.clientName}
              </a>
            )}
          </motion.div>
        )}

        {/* ── Property Details ──────────────────────────────── */}
        {booking?.property && (
          <ErrorBoundary fallback={
            <div className="p-5 rounded-2xl app-card">
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">Property Details</h2>
              <p className="text-xs text-[#9FB0A6]">Unable to load property details at this time.</p>
            </div>
          }>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-5 rounded-2xl app-card"
            >
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">Property Details</h2>
              <h3 className="text-base font-bold text-[#F0F7F3] mb-3">{booking.property.name}</h3>
              {booking.property.description && (
                <p className="text-sm text-[#9FB0A6] mb-4">{booking.property.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {booking.property.price && (
                  <div className="p-3 rounded-xl app-card text-center">
                    <IndianRupee className="w-4 h-4 text-green-400 mx-auto mb-1" />
                    <div className="text-sm font-bold text-[#F0F7F3]">₹{booking.property.price.toLocaleString("en-IN")}</div>
                    <div className="text-[10px] text-[#9FB0A6]">Price</div>
                  </div>
                )}
                {booking.property.bedrooms && (
                  <div className="p-3 rounded-xl app-card text-center">
                    <Bed className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                    <div className="text-sm font-bold text-[#F0F7F3]">{booking.property.bedrooms}</div>
                    <div className="text-[10px] text-[#9FB0A6]">Bedrooms</div>
                  </div>
                )}
                {booking.property.bathrooms && (
                  <div className="p-3 rounded-xl app-card text-center">
                    <Bath className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                    <div className="text-sm font-bold text-[#F0F7F3]">{booking.property.bathrooms}</div>
                    <div className="text-[10px] text-[#9FB0A6]">Bathrooms</div>
                  </div>
                )}
                {booking.property.area && (
                  <div className="p-3 rounded-xl app-card text-center">
                    <Maximize className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                    <div className="text-sm font-bold text-[#F0F7F3]">{booking.property.area}</div>
                    <div className="text-[10px] text-[#9FB0A6]">{booking.property.areaUnit}</div>
                  </div>
                )}
              </div>
              {booking.property.amenities && booking.property.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {booking.property.amenities.slice(0, 6).map((a, i) => (
                    <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-[#101713] text-[#9FB0A6] border border-white/10">{a}</span>
                  ))}
                  {booking.property.amenities.length > 6 && (
                    <span className="text-[11px] text-[#9FB0A6]">+{booking.property.amenities.length - 6} more</span>
                  )}
                </div>
              )}
            </motion.div>
          </ErrorBoundary>
        )}

        {/* ── More Properties ───────────────────────────────── */}
        {properties.length > 0 && (
          <ErrorBoundary fallback={
            <div className="p-5 rounded-2xl app-card">
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">More Properties</h2>
              <p className="text-xs text-[#9FB0A6]">Unable to load properties at this time.</p>
            </div>
          }>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="p-5 rounded-2xl app-card"
            >
              <button onClick={() => setShowAllProperties(!showAllProperties)}
                className="w-full flex items-center justify-between"
              >
                <h2 className="text-sm font-semibold text-[#F0F7F3]">More Properties ({properties.length})</h2>
                {showAllProperties ? <ChevronUp className="w-4 h-4 text-[#9FB0A6]" /> : <ChevronDown className="w-4 h-4 text-[#9FB0A6]" />}
              </button>
              {showAllProperties && (
                <div className="mt-4 space-y-2">
                  {properties.map((p, i) => (
                    <div key={i} className="p-3 rounded-xl app-card flex items-center justify-between">
                      <div>
                        <div className="text-sm text-[#F0F7F3]">{p.name}</div>
                        {p.price && <div className="text-xs text-[#9FB0A6]">₹{p.price.toLocaleString("en-IN")}</div>}
                      </div>
                      {p.bedrooms && <span className="text-xs text-[#9FB0A6]">{p.bedrooms} BHK</span>}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </ErrorBoundary>
        )}

        {/* ── Lead Info Summary ─────────────────────────────── */}
        {booking && (
          <ErrorBoundary fallback={
            <div className="p-4 rounded-2xl app-card">
              <h2 className="text-xs font-semibold text-[#F0F7F3] mb-3">Your Details</h2>
              <p className="text-xs text-[#9FB0A6]">Unable to load details.</p>
            </div>
          }>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="p-4 rounded-2xl app-card"
            >
              <h2 className="text-xs font-semibold text-[#F0F7F3] mb-3">Your Details</h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#9FB0A6]">Name</span>
                  <span className="text-[#F0F7F3]">{customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9FB0A6]">Phone</span>
                  <span className="text-[#F0F7F3]">{customer.phone}</span>
                </div>
                {customer.email && (
                  <div className="flex justify-between">
                    <span className="text-[#9FB0A6]">Email</span>
                    <span className="text-[#F0F7F3]">{customer.email}</span>
                  </div>
                )}
                {customer.budget && (
                  <div className="flex justify-between">
                    <span className="text-[#9FB0A6]">Budget</span>
                    <span className="text-[#F0F7F3]">₹{customer.budget}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#9FB0A6]">Lead Score</span>
                  <span className={cn("font-medium", customer.score >= 70 ? "text-green-400" : customer.score >= 40 ? "text-amber-400" : "text-[#9FB0A6]")}>
                    {customer.score}/100
                  </span>
                </div>
              </div>
            </motion.div>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

/** Small inline icon for fallback states — avoids requiring AlertCircle import at top level */
function AlertCircleIcon() {
  return (
    <svg className="w-8 h-8 text-red-400 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

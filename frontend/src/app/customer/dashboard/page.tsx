"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar, Clock, MapPin, Home, Phone, Building2, Star,
  IndianRupee, Bed, Bath, Maximize, CheckCircle2, XCircle,
  ArrowLeft, Loader2, RefreshCw, User, Zap, MessageSquare,
  ChevronDown, ChevronUp, FileText, History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

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
  CANCELLED: { label: "Cancelled", color: "text-gray-400 border-gray-500/20 bg-gray-500/10", icon: XCircle },
};

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
      const res = await fetch(`${API_BASE}/customer/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.clear();
          router.push("/customer/login");
          return;
        }
        throw new Error("Failed to load profile");
      }

      const data = await res.json();
      setCustomer(data.customer);
      setBooking(data.booking);

      // Cache in session
      sessionStorage.setItem("customer_data", JSON.stringify(data.customer));
      if (data.booking) {
        sessionStorage.setItem("customer_booking", JSON.stringify(data.booking));
      }

      // Load available properties
      const propRes = await fetch(`${API_BASE}/customer/properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (propRes.ok) {
        const propData = await propRes.json();
        setProperties(propData.properties || []);
      }
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
      const token = sessionStorage.getItem("customer_token");
      const res = await fetch(`${API_BASE}/customer/bookings/${booking!.id}/reschedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visitDate: newDate, visitTime: newTime }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reschedule");
      }

      toast.success("Visit rescheduled successfully!");
      setShowReschedule(false);
      await loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to reschedule");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      const token = sessionStorage.getItem("customer_token");
      const res = await fetch(`${API_BASE}/customer/bookings/${booking!.id}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel");
      }

      toast.success("Visit cancelled");
      setShowCancel(false);
      await loadProfile();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    } finally {
      setActionLoading(false);
    }
  }

  function getBookingStatus() {
    if (!booking) return null;
    return STATUS_CONFIG[booking.status] || { label: booking.status, color: "text-gray-400", icon: Clock };
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4F6EF7] animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Session expired</p>
          <button onClick={() => router.push("/customer/login")}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm"
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
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4F6EF7] to-[#6B8AFF] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">LeadBridge</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadProfile} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => { sessionStorage.clear(); router.push("/customer/login"); }}
              className="text-xs text-gray-500 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#1A1A24] to-[#111118] border border-white/10"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F6EF7] to-[#6B8AFF] flex items-center justify-center">
              <span className="text-white text-sm font-bold">{customer.name[0]}</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Namaste, {customer.name}! 👋</h1>
              <p className="text-xs text-gray-500">{customer.clientName} — {customer.clientCity}</p>
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

          {/* Quick Actions Navigation */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
            <Link href="/customer/bookings"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs hover:bg-white/10 transition-all"
            >
              <History className="w-3.5 h-3.5" />
              Booking History
            </Link>
            <Link href="/customer/documents"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs hover:bg-white/10 transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              Upload Documents
            </Link>
          </div>
        </motion.div>

        {booking ? (
          <>
            {/* Booking Status Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="p-5 rounded-2xl bg-white/5 border border-white/10"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white mb-1">Your Visit</h2>
                  <p className="text-xs text-gray-500">Property Visit Booking</p>
                </div>
                {statusInfo && (
                  <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.label}
                  </span>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <Calendar className="w-4 h-4 text-[#4F6EF7] mb-1" />
                  <div className="text-sm font-semibold text-white">{formatDate(booking.visitDate)}</div>
                  <div className="text-[11px] text-gray-500">Date</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <Clock className="w-4 h-4 text-[#22D3A5] mb-1" />
                  <div className="text-sm font-semibold text-white">{booking.visitTime}</div>
                  <div className="text-[11px] text-gray-500">Time</div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <MapPin className="w-4 h-4 text-red-400 mt-0.5" />
                <div>
                  <div className="text-sm text-white">{booking.propertyAddress}</div>
                  {booking.propertyName && (
                    <div className="text-xs text-gray-500 mt-0.5">{booking.propertyName}</div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {booking.notes && (
                <p className="text-xs text-gray-500 mt-3">{booking.notes}</p>
              )}

              {/* Actions */}
              {!["VISITED", "CANCELLED", "NO_SHOW"].includes(booking.status) && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-white/10">
                  <button onClick={() => { setNewDate(""); setNewTime(""); setShowReschedule(!showReschedule); setShowCancel(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-xs hover:bg-white/5 transition-all"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Reschedule
                  </button>
                  <button onClick={() => { setCancelReason(""); setShowCancel(!showCancel); setShowReschedule(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-400 text-xs hover:bg-red-500/5 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancel Visit
                  </button>
                </div>
              )}

              {/* Reschedule Form */}
              {showReschedule && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 pt-4 border-t border-white/10 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">New Date</label>
                      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#4F6EF7]/50"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">New Time</label>
                      <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#4F6EF7]/50"
                      />
                    </div>
                  </div>
                  <button onClick={handleReschedule} disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#4F6EF7] text-white text-xs font-medium hover:opacity-90 transition-all disabled:opacity-40"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Confirm Reschedule
                  </button>
                </motion.div>
              )}

              {/* Cancel Form */}
              {showCancel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 pt-4 border-t border-white/10 space-y-3"
                >
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Reason (optional)</label>
                    <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Not interested anymore">Not interested anymore</option>
                      <option value="Found another property">Found another property</option>
                      <option value="Timing doesn't work">Timing doesn&apos;t work</option>
                      <option value="Too far / location issue">Too far / location issue</option>
                      <option value="Already purchased">Already purchased</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <button onClick={handleCancel} disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-all disabled:opacity-40"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Confirm Cancellation
                  </button>
                </motion.div>
              )}
            </motion.div>

            {/* Property Details */}
            {booking.property && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="p-5 rounded-2xl bg-white/5 border border-white/10"
              >
                <h2 className="text-sm font-semibold text-white mb-4">Property Details</h2>
                <h3 className="text-base font-bold text-white mb-3">{booking.property.name}</h3>

                {booking.property.description && (
                  <p className="text-sm text-gray-400 mb-4">{booking.property.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {booking.property.price && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                      <IndianRupee className="w-4 h-4 text-green-400 mx-auto mb-1" />
                      <div className="text-sm font-bold text-white">₹{booking.property.price.toLocaleString("en-IN")}</div>
                      <div className="text-[10px] text-gray-500">Price</div>
                    </div>
                  )}
                  {booking.property.bedrooms && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                      <Bed className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                      <div className="text-sm font-bold text-white">{booking.property.bedrooms}</div>
                      <div className="text-[10px] text-gray-500">Bedrooms</div>
                    </div>
                  )}
                  {booking.property.bathrooms && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                      <Bath className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <div className="text-sm font-bold text-white">{booking.property.bathrooms}</div>
                      <div className="text-[10px] text-gray-500">Bathrooms</div>
                    </div>
                  )}
                  {booking.property.area && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                      <Maximize className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <div className="text-sm font-bold text-white">{booking.property.area}</div>
                      <div className="text-[10px] text-gray-500">{booking.property.areaUnit}</div>
                    </div>
                  )}
                </div>

                {booking.property.amenities && booking.property.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {booking.property.amenities.slice(0, 6).map((a, i) => (
                      <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-white/5 text-gray-400 border border-white/5">
                        {a}
                      </span>
                    ))}
                    {booking.property.amenities.length > 6 && (
                      <span className="text-[11px] text-gray-500">+{booking.property.amenities.length - 6} more</span>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Other Available Properties */}
            {properties.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="p-5 rounded-2xl bg-white/5 border border-white/10"
              >
                <button onClick={() => setShowAllProperties(!showAllProperties)}
                  className="w-full flex items-center justify-between"
                >
                  <h2 className="text-sm font-semibold text-white">
                    More Properties ({properties.length})
                  </h2>
                  {showAllProperties ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {showAllProperties && (
                  <div className="mt-4 space-y-2">
                    {properties.map((p, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white">{p.name}</div>
                          {p.price && <div className="text-xs text-gray-500">₹{p.price.toLocaleString("en-IN")}</div>}
                        </div>
                        {p.bedrooms && (
                          <span className="text-xs text-gray-400">{p.bedrooms} BHK</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </>
        ) : (
          /* No Booking */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center"
          >
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">No Active Bookings</h2>
            <p className="text-sm text-gray-500 mb-4">
              You don&apos;t have any upcoming visits scheduled. Contact your broker on WhatsApp.
            </p>
            {customer.clientContact && (
              <a href={`https://wa.me/${customer.clientContact.replace(/\D/g, "")}`} target="_blank"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 text-green-400 text-sm hover:bg-green-500/20 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Contact {customer.clientName}
              </a>
            )}
          </motion.div>
        )}

        {/* Lead Info Summary */}
        {booking && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl bg-white/5 border border-white/10"
          >
            <h2 className="text-xs font-semibold text-white mb-3">Your Details</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="text-white">{customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="text-white">{customer.phone}</span>
              </div>
              {customer.email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-white">{customer.email}</span>
                </div>
              )}
              {customer.budget && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Budget</span>
                  <span className="text-white">₹{customer.budget}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Lead Score</span>
                <span className={cn("font-medium", customer.score >= 70 ? "text-green-400" : customer.score >= 40 ? "text-amber-400" : "text-gray-400")}>
                  {customer.score}/100
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}



"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Home, MapPin, Bed, Bath, Maximize, IndianRupee,
  Star, Edit3, Trash2, Loader2, Calendar, Phone, Building2,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import type { Property, Booking, LeadStatus } from "@/types";

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function loadProperty() {
    try {
      const data = await api.get(`/properties/${params.id}`);
      setProperty(data.property);
    } catch (err: any) {
      toast.error(err.message || "Failed to load property");
      router.push("/dashboard/properties");
    } finally {
      setLoading(false);
    }
  }

  const bookingStatusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED": return "bg-blue-500/10 text-blue-400";
      case "REMINDED": return "bg-amber-500/10 text-amber-400";
      case "VISITED": return "bg-green-500/10 text-green-400";
      case "NO_SHOW": return "bg-red-500/10 text-red-400";
      case "RESCHEDULED": return "bg-yellow-500/10 text-yellow-400";
      case "CANCELLED": return "bg-gray-500/10 text-gray-400";
      default: return "bg-gray-500/10 text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-white/10 rounded" />
        <div className="h-64 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (!property) return null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={() => router.push("/dashboard/properties")}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Properties
      </button>

      {/* Hero Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-2xl bg-gradient-to-br from-[#1A1A24] to-[#111118] border border-white/10 overflow-hidden"
      >
        {/* Background pattern */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#4F6EF7]/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{property.name}</h1>
                {property.featured && (
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                )}
              </div>
              {property.location && (
                <p className="text-sm text-gray-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {property.location}{property.city ? `, ${property.city}` : ""}{property.zone ? ` • ${property.zone}` : ""}
                </p>
              )}
            </div>
            <span className={cn(
              "text-xs font-medium px-3 py-1 rounded-full border",
              property.status === "AVAILABLE" && "bg-green-500/10 text-green-400 border-green-500/20",
              property.status === "BOOKED" && "bg-blue-500/10 text-blue-400 border-blue-500/20",
              property.status === "SOLD" && "bg-purple-500/10 text-purple-400 border-purple-500/20",
              property.status === "OFF_MARKET" && "bg-gray-500/10 text-gray-400 border-gray-500/20",
            )}>
              {property.status.replace(/_/g, " ")}
            </span>
          </div>

          {/* Price */}
          <div className="text-3xl font-bold text-white mb-6">
            {property.price ? `₹${property.price.toLocaleString("en-IN")}` : "Price on request"}
            {property.price && <span className="text-sm text-gray-500 font-normal ml-2">{property.currency}</span>}
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {property.bedrooms && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                <Bed className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-white">{property.bedrooms}</div>
                <div className="text-[11px] text-gray-500">Bedrooms</div>
              </div>
            )}
            {property.bathrooms && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                <Bath className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-white">{property.bathrooms}</div>
                <div className="text-[11px] text-gray-500">Bathrooms</div>
              </div>
            )}
            {property.area && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                <Maximize className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-white">{property.area}</div>
                <div className="text-[11px] text-gray-500">{property.areaUnit}</div>
              </div>
            )}
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
              <Calendar className="w-5 h-5 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">
                {(property as any)._count?.bookings || 0}
              </div>
              <div className="text-[11px] text-gray-500">Bookings</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="xl:col-span-2 space-y-6">
          {/* Description */}
          {property.description && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-white/5 border border-white/10"
            >
              <h2 className="text-sm font-semibold text-white mb-3">Description</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{property.description}</p>
            </motion.div>
          )}

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-white/5 border border-white/10"
            >
              <h2 className="text-sm font-semibold text-white mb-3">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 border border-white/5">
                    {amenity}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tags */}
          {property.tags && property.tags.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-white/5 border border-white/10"
            >
              <h2 className="text-sm font-semibold text-white mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {property.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-[#4F6EF7]/10 text-[#4F6EF7] border border-[#4F6EF7]/20">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Bookings list */}
          {(property as any).bookings?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl bg-white/5 border border-white/10"
            >
              <h2 className="text-sm font-semibold text-white mb-4">Recent Bookings</h2>
              <div className="space-y-2">
                {(property as any).bookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-[#4F6EF7]/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[#4F6EF7]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {booking.lead?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(booking.visitDate)} at {booking.visitTime}
                        {booking.lead?.phone && ` • ${booking.lead.phone}`}
                      </p>
                    </div>
                    <span className={cn("text-[11px] px-2 py-0.5 rounded-full", bookingStatusColor(booking.status))}>
                      {booking.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Quick actions */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-xl bg-white/5 border border-white/10"
          >
            <h2 className="text-sm font-semibold text-white mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => router.push("/dashboard/properties")}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-all"
          >
            <Edit3 className="w-4 h-4" />
            Edit in List View
          </button>
          <button onClick={async () => {
            try {
              await api.post(`/properties/${property.id}/feature`);
              await loadProperty();
              toast.success(property.featured ? "Unfeatured" : "Featured");
            } catch { toast.error("Failed to toggle"); }
          }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-all"
          >
            <Star className="w-4 h-4" />
            {property.featured ? "Unfeature" : "Feature"}
          </button>
          <button onClick={() => router.push("/dashboard/leads")}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm hover:bg-white/10 transition-all"
          >
            <Building2 className="w-4 h-4" />
            View All Leads
          </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="p-5 rounded-xl bg-white/5 border border-white/10"
          >
            <h2 className="text-sm font-semibold text-white mb-4">Property Details</h2>
            <dl className="space-y-3">
              {[
                { label: "Status", value: property.status.replace(/_/g, " ") },
                { label: "Price", value: property.price ? `₹${property.price.toLocaleString("en-IN")}` : "—" },
                { label: "Bedrooms", value: property.bedrooms ? String(property.bedrooms) : "—" },
                { label: "Bathrooms", value: property.bathrooms ? String(property.bathrooms) : "—" },
                { label: "Area", value: property.area ? `${property.area} ${property.areaUnit}` : "—" },
                { label: "City", value: property.city || "—" },
                { label: "Zone", value: property.zone || "—" },
                { label: "Featured", value: property.featured ? "Yes" : "No" },
                { label: "Created", value: formatDate(property.createdAt) },
              ].map((d) => (
                <div key={d.label} className="flex items-center justify-between">
                  <dt className="text-xs text-gray-500">{d.label}</dt>
                  <dd className="text-xs text-white font-medium">{d.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* AI Sync status */}
          {property.lastSyncedToAgentAt && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-4 rounded-xl bg-[#4F6EF7]/5 border border-[#4F6EF7]/10"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">
                  Synced to AI agent {formatDate(property.lastSyncedToAgentAt)}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

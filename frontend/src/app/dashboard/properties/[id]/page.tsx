"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Home, MapPin, Bed, Bath, Maximize, IndianRupee,
  Star, Edit3, Trash2, Loader2, Calendar, Phone, Building2,
  CheckCircle2, XCircle, Clock, X, Camera, Tags,
} from "lucide-react";
import type { Property, PropertyStatus } from "@/types";

const PROPERTY_STATUS_OPTIONS: { value: PropertyStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "SOLD", label: "Sold" },
  { value: "OFF_MARKET", label: "Off Market" },
];

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    location: "",
    city: "",
    zone: "",
    status: "AVAILABLE" as PropertyStatus,
    amenities: "",
    tags: "",
    featured: false,
  });
  const [saving, setSaving] = useState(false);

  function openEditModal() {
    if (!property) return;
    setEditForm({
      name: property.name,
      description: property.description || "",
      price: property.price ? String(property.price) : "",
      bedrooms: property.bedrooms ? String(property.bedrooms) : "",
      bathrooms: property.bathrooms ? String(property.bathrooms) : "",
      area: property.area ? String(property.area) : "",
      location: property.location || "",
      city: property.city || "",
      zone: property.zone || "",
      status: property.status,
      amenities: (property.amenities || []).join(", "),
      tags: (property.tags || []).join(", "),
      featured: property.featured,
    });
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editForm.name.trim()) return toast.error("Property name is required");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        price: editForm.price ? Number(editForm.price) : undefined,
        bedrooms: editForm.bedrooms ? Number(editForm.bedrooms) : undefined,
        bathrooms: editForm.bathrooms ? Number(editForm.bathrooms) : undefined,
        area: editForm.area ? Number(editForm.area) : undefined,
        location: editForm.location.trim() || undefined,
        city: editForm.city.trim() || undefined,
        zone: editForm.zone.trim() || undefined,
        status: editForm.status,
        featured: editForm.featured,
        amenities: editForm.amenities ? editForm.amenities.split(",").map((s) => s.trim()).filter(Boolean) : [],
        tags: editForm.tags ? editForm.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      };
      await api.patch(`/properties/${property!.id}`, body);
      toast.success("Property updated");
      setShowEditModal(false);
      await loadProperty();
    } catch (err: any) {
      toast.error(err.message || "Failed to update property");
    } finally {
      setSaving(false);
    }
  }

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
      case "CANCELLED": return "bg-gray-500/10 text-[#9FB0A6]";
      default: return "bg-gray-500/10 text-[#9FB0A6]";
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-white/[0.06] rounded" />
        <div className="h-64 bg-[#101713] rounded-xl" />
      </div>
    );
  }

  if (!property) return null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={() => router.push("/dashboard/properties")}
        className="flex items-center gap-2 text-sm text-[#9FB0A6] hover:text-[#F0F7F3] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Properties
      </button>

      {/* Hero Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 overflow-hidden"
      >
        {/* Background pattern */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#34D399]/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-[#F0F7F3]">{property.name}</h1>
                {property.featured && (
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                )}
              </div>
              {property.location && (
                <p className="text-sm text-[#9FB0A6] flex items-center gap-1.5">
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
              property.status === "OFF_MARKET" && "bg-gray-500/10 text-[#9FB0A6] border-gray-500/20",
            )}>
              {property.status.replace(/_/g, " ")}
            </span>
          </div>

          {/* Price */}
          <div className="text-3xl font-bold text-[#F0F7F3] mb-6">
            {property.price ? `₹${property.price.toLocaleString("en-IN")}` : "Price on request"}
            {property.price && <span className="text-sm text-[#9FB0A6] font-normal ml-2">{property.currency}</span>}
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {property.bedrooms && (
              <div className="p-3 rounded-xl app-card text-center">
                <Bed className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-[#F0F7F3]">{property.bedrooms}</div>
                <div className="text-[11px] text-[#9FB0A6]">Bedrooms</div>
              </div>
            )}
            {property.bathrooms && (
              <div className="p-3 rounded-xl app-card text-center">
                <Bath className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-[#F0F7F3]">{property.bathrooms}</div>
                <div className="text-[11px] text-[#9FB0A6]">Bathrooms</div>
              </div>
            )}
            {property.area && (
              <div className="p-3 rounded-xl app-card text-center">
                <Maximize className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <div className="text-lg font-bold text-[#F0F7F3]">{property.area}</div>
                <div className="text-[11px] text-[#9FB0A6]">{property.areaUnit}</div>
              </div>
            )}
            <div className="p-3 rounded-xl app-card text-center">
              <Calendar className="w-5 h-5 text-purple-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-[#F0F7F3]">
                {(property as any)._count?.bookings || 0}
              </div>
              <div className="text-[11px] text-[#9FB0A6]">Bookings</div>
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
              className="p-5 rounded-xl app-card"
            >
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-3">Description</h2>
              <p className="text-sm text-[#9FB0A6] leading-relaxed">{property.description}</p>
            </motion.div>
          )}

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl app-card"
            >
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-3">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((amenity, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-[#101713] text-[#9FB0A6] border border-white/10">
                    {amenity}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Tags */}
          {property.tags && property.tags.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl app-card"
            >
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {property.tags.map((tag, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-[#34D399]/15 text-[#6FE3B0] border border-[#34D399]/30">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Bookings list */}
          {(property as any).bookings?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl app-card"
            >
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">Recent Bookings</h2>
              <div className="space-y-2">
                {(property as any).bookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center gap-3 p-3 rounded-lg app-card">
                    <div className="w-8 h-8 rounded-full bg-[#34D399]/15 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[#6FE3B0]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F0F7F3] truncate">
                        {booking.lead?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-[#9FB0A6]">
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
            className="p-5 rounded-xl app-card"
          >
            <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={openEditModal}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#34D399]/15 text-[#6FE3B0] text-sm font-medium hover:bg-[#34D399]/25 transition-all"
              >
                <Edit3 className="w-4 h-4" />
                Edit Property
              </button>
              <button onClick={async () => {
                try {
                  await api.post(`/properties/${property.id}/feature`);
                  await loadProperty();
                  toast.success(property.featured ? "Unfeatured" : "Featured");
                } catch { toast.error("Failed to toggle"); }
              }}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#101713] text-[#9FB0A6] text-sm hover:bg-white/[0.06] transition-all"
              >
                <Star className="w-4 h-4" />
                {property.featured ? "Unfeature" : "Feature"}
              </button>
              <button onClick={() => router.push("/dashboard/leads")}
                className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#101713] text-[#9FB0A6] text-sm hover:bg-white/[0.06] transition-all"
              >
                <Building2 className="w-4 h-4" />
                View All Leads
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="p-5 rounded-xl app-card"
          >
            <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4">Property Details</h2>
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
                  <dt className="text-xs text-[#9FB0A6]">{d.label}</dt>
                  <dd className="text-xs text-[#F0F7F3] font-medium">{d.value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          {/* AI Sync status */}
          {property.lastSyncedToAgentAt && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-4 rounded-xl bg-[#34D399]/10 border border-[#34D399]/50/10"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-xs text-[#9FB0A6]">
                  Synced to AI agent {formatDate(property.lastSyncedToAgentAt)}
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Inline Edit Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowEditModal(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl app-card p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-[#F0F7F3]">Edit Property</h2>
                <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#9FB0A6] mb-1.5 block">Property Name *</label>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">Price (₹)</label>
                    <input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} type="number"
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">Bedrooms</label>
                    <input value={editForm.bedrooms} onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value })} type="number"
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">Bathrooms</label>
                    <input value={editForm.bathrooms} onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value })} type="number"
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">Area (sqft)</label>
                    <input value={editForm.area} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} type="number"
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">Status</label>
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as PropertyStatus })}
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm"
                    >
                      {PROPERTY_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">Location</label>
                    <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">City</label>
                    <input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#9FB0A6] mb-1.5 block">Zone</label>
                    <input value={editForm.zone} onChange={(e) => setEditForm({ ...editForm, zone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#9FB0A6] mb-1.5 block">Description</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9FB0A6] mb-1.5 flex items-center gap-1.5">
                    <Camera className="w-3 h-3" /> Amenities (comma-separated)
                  </label>
                  <input value={editForm.amenities} onChange={(e) => setEditForm({ ...editForm, amenities: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-[#9FB0A6] mb-1.5 flex items-center gap-1.5">
                    <Tags className="w-3 h-3" /> Tags (comma-separated)
                  </label>
                  <input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm focus:outline-none focus:border-[#34D399]/50/50"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <button onClick={() => setEditForm({ ...editForm, featured: !editForm.featured })}
                    className={cn("relative w-10 h-5 rounded-full transition-colors", editForm.featured ? "bg-amber-500" : "bg-white/[0.06]")}
                  >
                    <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-[#101713] transition-transform", editForm.featured ? "translate-x-5" : "translate-x-0.5")} />
                  </button>
                  <span className="text-sm text-[#9FB0A6]">Feature this property</span>
                  {editForm.featured && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-[#9FB0A6] text-sm hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-sm font-medium hover:opacity-90"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

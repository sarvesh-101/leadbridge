"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Home, MapPin, Bed, Bath, Maximize, IndianRupee,
  Star, Search, X, Loader2, Trash2, Edit3, Camera, Tags,
  ToggleLeft, ToggleRight, Building2, RefreshCw,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import type { Property, PropertyStatus } from "@/types";

const PROPERTY_STATUS_COLORS: Record<PropertyStatus, string> = {
  AVAILABLE: "bg-green-500/10 text-green-400 border-green-500/20",
  BOOKED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  SOLD: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OFF_MARKET: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const PROPERTY_STATUS_OPTIONS: { value: PropertyStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "SOLD", label: "Sold" },
  { value: "OFF_MARKET", label: "Off Market" },
];

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState({
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

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const data = await api.get(`/properties?${params.toString()}`);
      setProperties(data.properties || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // Stats
  const availableCount = properties.filter((p) => p.status === "AVAILABLE").length;
  const featuredCount = properties.filter((p) => p.featured).length;
  const totalPrice = properties.reduce((sum, p) => sum + (p.price || 0), 0);

  function openCreateModal() {
    setEditingProperty(null);
    setFormData({
      name: "", description: "", price: "", bedrooms: "", bathrooms: "",
      area: "", location: "", city: "", zone: "", status: "AVAILABLE",
      amenities: "", tags: "", featured: false,
    });
    setShowModal(true);
  }

  function openEditModal(property: Property) {
    setEditingProperty(property);
    setFormData({
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
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.name.trim()) return toast.error("Property name is required");
    setActionLoading("save");

    try {
      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: formData.price ? Number(formData.price) : undefined,
        bedrooms: formData.bedrooms ? Number(formData.bedrooms) : undefined,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : undefined,
        area: formData.area ? Number(formData.area) : undefined,
        location: formData.location.trim() || undefined,
        city: formData.city.trim() || undefined,
        zone: formData.zone.trim() || undefined,
        status: formData.status,
        featured: formData.featured,
        amenities: formData.amenities ? formData.amenities.split(",").map((s) => s.trim()).filter(Boolean) : [],
        tags: formData.tags ? formData.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      };

      if (editingProperty) {
        await api.patch(`/properties/${editingProperty.id}`, body);
        toast.success("Property updated");
      } else {
        await api.post("/properties", body);
        toast.success("Property created");
      }

      setShowModal(false);
      await loadProperties();
    } catch (err: any) {
      toast.error(err.message || "Failed to save property");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(`delete-${id}`);
    try {
      await api.delete(`/properties/${id}`);
      toast.success("Property deleted");
      setDeleteId(null);
      await loadProperties();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete property");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleFeatured(id: string) {
    setActionLoading(`feature-${id}`);
    try {
      await api.post(`/properties/${id}/feature`);
      await loadProperties();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle featured");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSyncAI() {
    setActionLoading("sync");
    try {
      await api.post("/properties/sync-knowledge");
      await loadProperties();
      toast.success("Property data synced to AI agent");
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Properties</h1>
          <p className="text-gray-400 mt-1">Manage your property listings</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSyncAI} disabled={actionLoading === "sync"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", actionLoading === "sync" && "animate-spin")} />
            Sync to AI Agent
          </button>
          <button onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Property
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: total, icon: Building2, color: "text-blue-400" },
          { label: "Available", value: availableCount, icon: Home, color: "text-green-400" },
          { label: "Featured", value: featuredCount, icon: Star, color: "text-amber-400" },
          { label: "Total Value", value: `₹${(totalPrice / 10000000).toFixed(1)}Cr`, icon: IndianRupee, color: "text-purple-400" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10"
          >
            {loading ? (
              <div className="animate-pulse"><div className="h-5 w-16 bg-white/10 rounded" /></div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={cn("w-4 h-4", s.color)} />
                  <span className="text-xs text-gray-500">{s.label}</span>
                </div>
                <div className="text-xl font-bold text-white">{s.value}</div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search properties by name, location..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm"
        >
          <option value="all">All Status</option>
          {PROPERTY_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Property Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse h-48 bg-white/5 rounded-xl" />
          ))}
        </div>
      ) : properties.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.map((property, i) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="group relative p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#4F6EF7]/30 transition-all cursor-pointer"
              >
                {/* Featured badge */}
                {property.featured && (
                  <div className="absolute top-3 right-3">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-[#4F6EF7] transition-colors">
                      {property.name}
                    </h3>
                    {property.location && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {property.location}{property.city ? `, ${property.city}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Specs */}
                <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-400">
                  {property.bedrooms && (
                    <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{property.bedrooms} BHK</span>
                  )}
                  {property.bathrooms && (
                    <span className="flex items-center gap-1"><Bath className="w-3 h-3" />{property.bathrooms}</span>
                  )}
                  {property.area && (
                    <span className="flex items-center gap-1"><Maximize className="w-3 h-3" />{property.area} {property.areaUnit}</span>
                  )}
                </div>

                {/* Price + Status */}
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">
                    {property.price ? `₹${property.price.toLocaleString("en-IN")}` : "—"}
                  </span>
                  <span className={cn(
                    "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                    PROPERTY_STATUS_COLORS[property.status]
                  )}>
                    {property.status.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Amenities */}
                {property.amenities && property.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {property.amenities.slice(0, 3).map((a, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                        {a}
                      </span>
                    ))}
                    {property.amenities.length > 3 && (
                      <span className="text-[10px] text-gray-500">+{property.amenities.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleToggleFeatured(property.id); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-400 hover:bg-white/5 transition-colors"
                    title={property.featured ? "Unfeature" : "Feature"}
                  >
                    {property.featured ? <ToggleRight className="w-3.5 h-3.5 text-amber-400" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    Feature
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(property); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-gray-400 hover:bg-white/5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(property.id); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} total={total} pageSize={20} onPageChange={setPage} />
          )}
        </>
      ) : (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Add your first property listing to start matching leads with the right options"
          action={{ label: "Add Property", onClick: openCreateModal }}
        />
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111118] border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editingProperty ? "Edit Property" : "Add Property"}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Property Name *</label>
                  <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Lakeside Villa, 3BHK Apartment"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Price */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Price (₹)</label>
                    <input value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="e.g., 7500000" type="number"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    />
                  </div>
                  {/* Bedrooms */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Bedrooms</label>
                    <input value={formData.bedrooms} onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                      placeholder="e.g., 3" type="number"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    />
                  </div>
                  {/* Bathrooms */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Bathrooms</label>
                    <input value={formData.bathrooms} onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                      placeholder="e.g., 2" type="number"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Area */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Area (sqft)</label>
                    <input value={formData.area} onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                      placeholder="e.g., 1500" type="number"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    />
                  </div>
                  {/* Status */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as PropertyStatus })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                    >
                      {PROPERTY_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Location */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="text-xs text-gray-500 mb-1.5 block">Location / Address</label>
                    <input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Full address"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">City</label>
                    <input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g., Mumbai"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Zone / Area</label>
                    <input value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                      placeholder="e.g., Andheri West"
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the property — key features, nearby landmarks, etc."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50 resize-none"
                  />
                </div>

                {/* Amenities */}
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <Camera className="w-3 h-3" /> Amenities (comma-separated)
                  </label>
                  <input value={formData.amenities} onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                    placeholder="e.g., Swimming Pool, Gym, Parking, Security"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
                    <Tags className="w-3 h-3" /> Tags (comma-separated)
                  </label>
                  <input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="e.g., Corner Unit, New Construction, Furnished"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                  />
                </div>

                {/* Featured toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <button onClick={() => setFormData({ ...formData, featured: !formData.featured })}
                    className={cn(
                      "relative w-10 h-5 rounded-full transition-colors",
                      formData.featured ? "bg-amber-500" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                      formData.featured ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </button>
                  <span className="text-sm text-gray-400">Feature this property</span>
                  {formData.featured && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button onClick={handleSave} disabled={actionLoading === "save"}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 transition-all"
                >
                  {actionLoading === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingProperty ? "Update Property" : "Create Property"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDeleteId(null)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl bg-[#111118] border border-white/10 p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Delete Property?</h3>
              <p className="text-sm text-gray-400 mb-6">This action cannot be undone. All booking references will remain.</p>
              <div className="flex items-center gap-3 justify-center">
                <button onClick={() => setDeleteId(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteId)} disabled={actionLoading === `delete-${deleteId}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all"
                >
                  {actionLoading === `delete-${deleteId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

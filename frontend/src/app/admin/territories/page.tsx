"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Globe, Plus, X, Loader2, Search, MapPin, Lock, Unlock,
  Users, CheckCircle, AlertCircle,
} from "lucide-react";

interface AdminTerritory {
  id: string;
  city: string;
  zone?: string | null;
  tier: number;
  locked: boolean;
  clientId?: string | null;
  client?: { businessName: string; ownerName: string } | null;
}

const TIER_LABELS: Record<number, string> = {
  1: "Metro (T1)",
  2: "Tier 2 City (T2)",
  3: "Tier 3 City (T3)",
};

export default function AdminTerritoriesPage() {
  const [territories, setTerritories] = useState<AdminTerritory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newZone, setNewZone] = useState("");
  const [newTier, setNewTier] = useState(2);

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (tierFilter !== "all") params.set("tier", tierFilter);
      const res = await api.get<{ items: AdminTerritory[]; total: number }>(`/admin/territories?${params}`);
      setTerritories(res.items);
    } catch (err: any) {
      console.error("Failed to load territories:", err);
    } finally {
      setLoading(false);
    }
  }, [search, tierFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreate() {
    if (!newCity.trim()) return toast.error("City is required");
    setActionLoading("create");
    try {
      await api.post("/admin/territories", { city: newCity, zone: newZone || undefined, tier: newTier });
      toast.success(`Territory '${newCity}${newZone ? ` - ${newZone}` : ""}' created`);
      setShowCreate(false);
      setNewCity("");
      setNewZone("");
      setNewTier(2);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create territory");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease(territoryId: string) {
    setActionLoading(`release-${territoryId}`);
    try {
      await api.post(`/admin/territories/${territoryId}/release`);
      toast.success("Territory released");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to release");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleLock(territory: AdminTerritory) {
    setActionLoading(`lock-${territory.id}`);
    try {
      await api.patch(`/admin/territories/${territory.id}`, { locked: !territory.locked });
      toast.success(territory.locked ? "Territory unlocked" : "Territory locked");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update territory");
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = territories.filter((t) => {
    const name = `${t.city}${t.zone ? ` ${t.zone}` : ""}`;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const occupied = territories.filter(t => t.clientId).length;
  const available = territories.filter(t => !t.clientId && !t.locked).length;
  const locked = territories.filter(t => t.locked).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Territory Management</h1>
          <p className="text-gray-400 mt-1">{territories.length} total territories</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Create Territory
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Occupied", value: occupied, icon: Users, color: "from-blue-500 to-blue-600" },
          { label: "Available", value: available, icon: CheckCircle, color: "from-green-500 to-green-600" },
          { label: "Locked", value: locked, icon: Lock, color: "from-orange-500 to-orange-600" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            {loading ? (
              <div className="animate-pulse"><div className="h-8 w-12 bg-white/10 rounded" /></div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search territories..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
          />
        </div>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm"
        >
          <option value="all">All Tiers</option>
          <option value="1">Metro (T1)</option>
          <option value="2">Tier 2 (T2)</option>
          <option value="3">Tier 3 (T3)</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No territories found</h3>
          <p className="text-sm text-gray-500">Create your first territory to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    {t.city}{t.zone ? ` - ${t.zone}` : ""}
                  </span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    t.clientId ? "bg-blue-500/10 text-blue-400" :
                    t.locked ? "bg-orange-500/10 text-orange-400" :
                    "bg-green-500/10 text-green-400"
                  )}>
                    {t.clientId ? "Occupied" : t.locked ? "Locked" : "Available"}
                  </span>
                  <span className="text-xs text-gray-500">{TIER_LABELS[t.tier] || `Tier ${t.tier}`}</span>
                </div>
                {t.client && (
                  <p className="text-xs text-gray-500 mt-1">
                    <Users className="w-3 h-3 inline mr-1" />
                    {t.client.businessName} · {t.client.ownerName}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleToggleLock(t)}
                  disabled={actionLoading === `lock-${t.id}` || !!t.clientId}
                  className={cn(
                    "p-2 rounded-lg border transition-colors",
                    t.locked ? "border-orange-500/20 text-orange-400 hover:bg-orange-500/10" :
                    "border-white/10 text-gray-400 hover:bg-white/5",
                    t.clientId ? "opacity-30 cursor-not-allowed" : ""
                  )}
                  title={t.locked ? "Unlock" : "Lock"}
                >
                  {actionLoading === `lock-${t.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : t.locked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>
                {t.clientId && (
                  <button onClick={() => handleRelease(t.id)}
                    disabled={actionLoading === `release-${t.id}`}
                    className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    title="Force release"
                  >
                    {actionLoading === `release-${t.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Create Territory</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">City *</label>
                  <input value={newCity} onChange={(e) => setNewCity(e.target.value)}
                    placeholder="e.g., Mumbai"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Zone (optional)</label>
                  <input value={newZone} onChange={(e) => setNewZone(e.target.value)}
                    placeholder="e.g., Andheri"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Tier</label>
                  <select value={newTier} onChange={(e) => setNewTier(parseInt(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                  >
                    <option value={1}>Metro (Tier 1) — ₹14,999/mo</option>
                    <option value={2}>Tier 2 City — ₹9,999/mo</option>
                    <option value={3}>Tier 3 City — ₹4,999/mo</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                >
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={!newCity.trim() || actionLoading === "create"}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading === "create" ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

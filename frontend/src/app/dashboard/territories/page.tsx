"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Globe, Shield, Search, MapPin, TrendingUp, Users, Loader2, CheckCircle, XCircle } from "lucide-react";
import type { Territory } from "@/types";

// Pricing by tier — derived from business logic, not stored in DB
const TIER_PRICING: Record<number, { price: number; label: string; businesses: number }> = {
  1: { price: 14999, label: "Metro", businesses: 1500 },
  2: { price: 9999, label: "Tier 2 City", businesses: 600 },
  3: { price: 4999, label: "Tier 3 City", businesses: 300 },
};

interface TerritoryItem {
  id: string;
  city: string;
  zone?: string;
  tier: number;
  locked: boolean;
  isAvailable: boolean;
  occupantName?: string | null;
}

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [myTerritory, setMyTerritory] = useState<Territory | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(async () => {
    try {
      const [territoriesRes, myRes] = await Promise.all([
        api.get<{ items: TerritoryItem[]; total: number }>("/territories"),
        api.get<{ territory: Territory | null }>("/territories/my"),
      ]);
      setTerritories(territoriesRes.items);
      setMyTerritory(myRes.territory);
    } catch (err: any) {
      toast.error("Failed to load territories")
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = territories.filter((t) => {
    const name = `${t.city}${t.zone ? ` ${t.zone}` : ""}`;
    const matchSearch = name.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === "all" || t.tier === parseInt(tierFilter);
    const matchStatus = statusFilter === "all" ||
      (statusFilter === "available" && t.isAvailable) ||
      (statusFilter === "occupied" && !t.isAvailable);
    return matchSearch && matchTier && matchStatus;
  });

  async function handlePurchase(territoryId: string) {
    setActionLoading(`purchase-${territoryId}`);
    try {
      await api.post("/territories/purchase", { territoryId });
      toast.success("Territory claimed successfully!");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to claim territory");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease() {
    setActionLoading("release");
    try {
      await api.post("/territories/release");
      toast.success("Territory released");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to release territory");
    } finally {
      setActionLoading(null);
    }
  }

  const availableCount = territories.filter(t => t.isAvailable).length;
  const occupiedCount = territories.filter(t => !t.isAvailable).length;
  const totalCount = territories.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Territory Exclusivity</h1>
        <p className="text-ink-soft mt-1">Purchase exclusive territories — only one business per area</p>
      </div>

      {/* My Territory Banner */}
      {!loading && myTerritory && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-xl bg-gradient-to-r from-line-subtle/10 to-brand-deep/5 border border-brand/40"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-brand-deep" />
              <div>
                <h3 className="text-sm font-semibold text-ink">Your Territory</h3>
                <p className="text-sm text-ink-soft">
                  {myTerritory.city}{myTerritory.zone ? ` - ${myTerritory.zone}` : ""}
                  <span className="text-ink-soft ml-2">Tier {myTerritory.tier} — {TIER_PRICING[myTerritory.tier]?.label}</span>
                </p>
              </div>
            </div>
            <button onClick={handleRelease} disabled={actionLoading === "release"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger/30 text-danger text-xs hover:bg-danger/10 disabled:opacity-50"
            >
              {actionLoading === "release" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Release
            </button>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Globe, label: "Total Territories", value: loading ? "—" : totalCount, color: "from-blue-500 to-blue-600" },
          { icon: Shield, label: "Available", value: loading ? "—" : availableCount, color: "from-success to-success" },
          { icon: TrendingUp, label: "My Territory", value: loading ? "—" : myTerritory ? 1 : 0, color: "from-purple-500 to-purple-600" },
          { icon: Users, label: "Occupied", value: loading ? "—" : occupiedCount, color: "from-orange-500 to-orange-600" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl app-card">
            {loading ? (
              <div className="animate-pulse"><div className="h-8 w-12 bg-white/[0.06] rounded" /></div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-ink">{s.value}</div>
                <div className="text-xs text-ink-soft">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cities or zones..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/60"
          />
        </div>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl app-card text-ink-soft text-sm focus:outline-none focus:border-brand/60"
        >
          <option value="all">All Tiers</option>
          <option value="1">Tier 1 (Metro)</option>
          <option value="2">Tier 2 (Cities)</option>
          <option value="3">Tier 3 (Smaller)</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl app-card text-ink-soft text-sm focus:outline-none focus:border-brand/60"
        >
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-5 rounded-xl app-card animate-pulse">
              <div className="h-4 w-16 bg-white/[0.06] rounded mb-3" />
              <div className="h-5 w-32 bg-white/[0.06] rounded mb-2" />
              <div className="h-3 w-24 bg-white/[0.06] rounded mb-4" />
              <div className="space-y-2 mb-4">
                <div className="h-3 w-full bg-white/[0.06] rounded" />
                <div className="h-3 w-full bg-white/[0.06] rounded" />
              </div>
              <div className="h-10 w-full bg-white/[0.06] rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl app-card">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-ink-soft" />
          <h3 className="text-lg font-medium text-ink mb-2">No territories found</h3>
          <p className="text-sm text-ink-soft">Try a different search or filter</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((t, i) => {
            const pricing = TIER_PRICING[t.tier] || { price: 9999, label: `Tier ${t.tier}`, businesses: 500 };
            const name = `${t.city}${t.zone ? ` - ${t.zone}` : ""}`;
            const isMine = myTerritory?.id === t.id;

            return (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className={cn(
                  "p-5 rounded-xl border transition-all group",
                  isMine
                    ? "bg-brand/15 border-brand/40"
                    : t.isAvailable
                    ? "bg-canvas border-line hover:bg-white/[0.06] hover:border-line"
                    : "bg-canvas border-line opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={cn(
                    "flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full",
                    isMine ? "bg-brand/25 text-brand-deep" :
                    t.isAvailable ? "bg-success/10 text-success" :
                    "bg-danger/10 text-danger"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", isMine ? "bg-brand" : t.isAvailable ? "bg-success" : "bg-danger")} />
                    {isMine ? "Yours" : t.isAvailable ? "Available" : "Occupied"}
                  </span>
                  <MapPin className="w-4 h-4 text-ink-soft" />
                </div>

                <h3 className="text-sm font-semibold text-ink">{name}</h3>
                <p className="text-xs text-ink-soft mt-1">{pricing.label}</p>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-soft">Businesses (est.)</span>
                    <span className="text-ink-soft">{pricing.businesses.toLocaleString()}+</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-soft">Tier</span>
                    <span className="text-brand-deep">{t.tier}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-ink">₹{pricing.price.toLocaleString()}</span>
                    <span className="text-xs text-ink-soft">/mo</span>
                  </div>
                  {isMine ? (
                    <span className="text-xs text-brand-deep font-medium">Active</span>
                  ) : t.isAvailable && !myTerritory ? (
                    <button onClick={() => handlePurchase(t.id)}
                      disabled={actionLoading === `purchase-${t.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand to-brand-soft text-canvas text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {actionLoading === `purchase-${t.id}` ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Claiming...</>
                      ) : "Claim"}
                    </button>
                  ) : (
                    <span className="text-xs text-ink-soft">
                      {myTerritory ? "Already own one" : "Unavailable"}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

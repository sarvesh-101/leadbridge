"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Globe, Shield, Search, MapPin, TrendingUp, Users } from "lucide-react";

const TERRITORIES = [
  { name: "Mumbai - Andheri", city: "Mumbai", state: "Maharashtra", tier: "tier_1", status: "occupied", price: 14999, businesses: 1240, potential: "Very High" },
  { name: "Mumbai - Thane", city: "Mumbai", state: "Maharashtra", tier: "tier_1", status: "available", price: 12999, businesses: 890, potential: "High" },
  { name: "Pune", city: "Pune", state: "Maharashtra", tier: "tier_2", status: "available", price: 9999, businesses: 670, potential: "High" },
  { name: "Nashik", city: "Nashik", state: "Maharashtra", tier: "tier_2", status: "available", price: 6999, businesses: 340, potential: "Medium" },
  { name: "Surat", city: "Surat", state: "Gujarat", tier: "tier_2", status: "reserved", price: 7999, businesses: 520, potential: "High" },
  { name: "Nagpur", city: "Nagpur", state: "Maharashtra", tier: "tier_3", status: "available", price: 4999, businesses: 280, potential: "Medium" },
  { name: "Delhi - South", city: "Delhi", state: "Delhi", tier: "tier_1", status: "occupied", price: 19999, businesses: 2100, potential: "Very High" },
  { name: "Bangalore - Whitefield", city: "Bangalore", state: "Karnataka", tier: "tier_1", status: "available", price: 15999, businesses: 1560, potential: "Very High" },
];

export default function TerritoriesPage() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");

  const filtered = TERRITORIES.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.city.toLowerCase().includes(search.toLowerCase());
    const matchTier = tierFilter === "all" || t.tier === tierFilter;
    return matchSearch && matchTier;
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "available": return { dot: "bg-green-500", bg: "bg-green-500/10 text-green-400", label: "Available" };
      case "occupied": return { dot: "bg-red-500", bg: "bg-red-500/10 text-red-400", label: "Occupied" };
      case "reserved": return { dot: "bg-yellow-500", bg: "bg-yellow-500/10 text-yellow-400", label: "Reserved" };
      default: return { dot: "bg-gray-500", bg: "bg-gray-500/10 text-gray-400", label: status };
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Territory Exclusivity</h1>
        <p className="text-gray-400 mt-1">Purchase exclusive territories — only one business per area</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Globe, label: "Total Territories", value: "24", color: "from-blue-500 to-blue-600" },
          { icon: Shield, label: "Available", value: "12", color: "from-green-500 to-green-600" },
          { icon: TrendingUp, label: "My Territories", value: "3", color: "from-purple-500 to-purple-600" },
          { icon: Users, label: "Waitlisted", value: "2", color: "from-orange-500 to-orange-600" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
              <s.icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search territories..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50" />
        </div>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
          <option value="all">All Tiers</option>
          <option value="tier_1">Tier 1 (Metro)</option>
          <option value="tier_2">Tier 2 (Cities)</option>
          <option value="tier_3">Tier 3 (Smaller)</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((t, i) => (
          <motion.div key={t.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
            className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full", statusColor(t.status).bg)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", statusColor(t.status).dot)} />
                {statusColor(t.status).label}
              </div>
              <MapPin className="w-4 h-4 text-gray-500" />
            </div>
            <h3 className="text-sm font-semibold text-white">{t.name}</h3>
            <p className="text-xs text-gray-500 mt-1">{t.city}, {t.state}</p>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Businesses</span>
                <span className="text-gray-300">{t.businesses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Potential</span>
                <span className="text-leadflow-accent">{t.potential}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-white">₹{t.price.toLocaleString()}</span>
                <span className="text-xs text-gray-500">/mo</span>
              </div>
              <button className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                t.status === "available" ? "bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white hover:opacity-90" :
                t.status === "reserved" ? "border border-yellow-500/50 text-yellow-400" :
                "border border-white/10 text-gray-400 cursor-not-allowed"
              )} disabled={t.status === "occupied"}>
                {t.status === "available" ? "Purchase" : t.status === "reserved" ? "Join Waitlist" : "Unavailable"}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Globe, TrendingUp, Users, Phone, Calendar, MapPin,
  Trophy, ArrowUp, ArrowDown, Loader2,
} from "lucide-react";

export default function TerritoryComparisonPage() {
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await api.get("/admin/territories/comparison");
      setTerritories(res.territories || []);
      setSummary(res.summary);
    } catch (err: any) {
      toast.error("Failed to load territory comparison");
    } finally {
      setLoading(false);
    }
  }

  const maxLeads = Math.max(...territories.map((t) => t.totalLeads), 1);
  const maxConvRate = Math.max(...territories.map((t) => t.avgConversionRate), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Territory Performance</h1>
        <p className="text-gray-400 mt-1">Compare broker performance across cities and territories</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}
          </>
        ) : (
          <>
            {[
              { icon: Globe, label: "Cities", value: summary?.totalCities || 0, color: "from-blue-500 to-blue-600" },
              { icon: Users, label: "Total Brokers", value: summary?.totalBrokers || 0, color: "from-green-500 to-green-600" },
              { icon: Trophy, label: "Top City", value: summary?.topCity || "—", color: "from-yellow-500 to-yellow-600" },
              { icon: TrendingUp, label: "Territories", value: territories.length, color: "from-purple-500 to-purple-600" },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Territory Cards */}
      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}</div>
      ) : territories.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No territory data</h3>
          <p className="text-sm text-gray-500">Data will appear once brokers are active</p>
        </div>
      ) : (
        <div className="space-y-4">
          {territories.map((territory, i) => (
            <motion.div key={territory.city} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    i === 0 ? "bg-yellow-500/20" : "bg-white/5"
                  )}>
                    {i === 0 ? <Trophy className="w-5 h-5 text-yellow-400" /> : <MapPin className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">{territory.city}</h3>
                    <p className="text-xs text-gray-500">{territory.totalClients} broker{territory.totalClients !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Top
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Users className="w-3 h-3" /> Total Leads
                  </div>
                  <div className="text-lg font-bold text-white">{territory.totalLeads.toLocaleString()}</div>
                  <div className="w-full h-1 rounded-full bg-white/5 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(territory.totalLeads / maxLeads) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Phone className="w-3 h-3" /> Total Calls
                  </div>
                  <div className="text-lg font-bold text-white">{territory.totalCalls.toLocaleString()}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Calendar className="w-3 h-3" /> Bookings
                  </div>
                  <div className="text-lg font-bold text-white">{territory.totalBookings.toLocaleString()}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <TrendingUp className="w-3 h-3" /> Conv. Rate
                  </div>
                  <div className="text-lg font-bold text-green-400">{territory.avgConversionRate}%</div>
                  <div className="w-full h-1 rounded-full bg-white/5 mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${(territory.avgConversionRate / maxConvRate) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Brokers list */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Brokers</p>
                <div className="flex flex-wrap gap-2">
                  {territory.brokers?.map((broker: any) => {
                    const isTop = broker.conversionRate >= Math.max(...territory.brokers.map((b: any) => b.conversionRate));
                    return (
                      <div key={broker.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                      >
                        <span className="text-gray-300">{broker.name}</span>
                        <span className="text-gray-600">|</span>
                        <span className={isTop ? "text-green-400 font-medium" : "text-gray-400"}>
                          {broker.conversionRate}% conv.
                        </span>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-500">{broker.leads} leads</span>
                        {isTop && <Trophy className="w-3 h-3 text-yellow-400" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

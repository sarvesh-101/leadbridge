"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { ArrowUp, ArrowDown, TrendingUp, Users, Phone, Calendar, Target } from "lucide-react";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [leadsBySource, setLeadsBySource] = useState<any[]>([]);
  const [leadsByStatus, setLeadsByStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const data = await api.get("/dashboard");
      setStats(data.stats);
      setLeadsBySource(data.leadsBySource || []);
      setLeadsByStatus(data.leadsByStatus || []);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  const metrics = [
    { label: "Leads Received", value: stats?.monthLeads ?? 0, change: "+12.5%", trend: "up" as const, icon: Users, color: "bg-blue-500" },
    { label: "Calls Made", value: stats?.monthCalls ?? 0, change: "+8.2%", trend: "up" as const, icon: Phone, color: "bg-amber-500" },
    { label: "Qualification Rate", value: `${stats?.qualifiedRate ?? 0}%`, change: "+15.3%", trend: "up" as const, icon: Target, color: "bg-purple-500" },
    { label: "Booking Rate", value: `${stats?.bookingRate ?? 0}%`, change: "+23.1%", trend: "up" as const, icon: Calendar, color: "bg-emerald-500" },
    { label: "Show Rate", value: `${stats?.showRate ?? 0}%`, change: "+5.4%", trend: "up" as const, icon: TrendingUp, color: "bg-indigo-500" },
    { label: "Conversion Rate", value: `${stats?.conversionRate ?? 0}%`, change: "+5.4%", trend: "up" as const, icon: Target, color: "bg-rose-500" },
  ];

  // Build funnel from actual lead status distribution
  const statusPriority: Record<string, number> = {
    PENDING: 0, CALLING: 1, CALL_FAILED: 2, NO_ANSWER: 3,
    FAQ_ONLY: 4, BOOKED: 5, REMINDED: 6, VISITED: 7,
    FOLLOWUP_D1: 8, FOLLOWUP_D2: 9, FOLLOWUP_D3: 10,
    NO_SHOW: 11, REBOOKED: 12, COLD: 13, CONVERTED: 14,
  };
  const totalLeads = Object.values(leadsByStatus).reduce((sum: number, s: any) => sum + (s._count?.id || 0), 0);
  const funnelStages = leadsByStatus
    .sort((a: any, b: any) => (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99))
    .map((s: any) => ({
      stage: s.status,
      count: s._count?.id || 0,
      percentage: totalLeads > 0 ? Math.round(((s._count?.id || 0) / totalLeads) * 100) : 0,
      color: s.status === "CONVERTED" ? "bg-emerald-500" :
             s.status === "VISITED" || s.status === "BOOKED" ? "bg-green-500" :
             s.status === "COLD" ? "bg-gray-500" :
             s.status === "NO_ANSWER" || s.status === "CALL_FAILED" ? "bg-red-500" :
             s.status === "FOLLOWUP_D1" || s.status === "FOLLOWUP_D2" || s.status === "FOLLOWUP_D3" ? "bg-yellow-500" :
             "bg-blue-500",
    }));

  const sourceColors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-cyan-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500"];
  const maxSourceCount = Math.max(...leadsBySource.map((s: any) => s._count?.id || 0), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-gray-400 mt-1">Detailed performance metrics and insights</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((m, i) => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10"
          >
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-6 w-16 bg-white/10 rounded" />
                <div className="h-3 w-20 bg-white/10 rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500">{m.label}</span>
                </div>
                <div className="text-lg font-bold text-white">{m.value}</div>
                <span className={cn("flex items-center gap-1 text-xs mt-1", m.trend === "up" ? "text-green-400" : "text-red-400")}>
                  {m.trend === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}{m.change}
                </span>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Conversion Funnel */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-6">Lead Funnel</h2>
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-white/10 rounded" />)}
          </div>
        ) : funnelStages.length > 0 ? (
          <div className="space-y-3">
            {funnelStages.map((stage) => (
              <div key={stage.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{stage.stage.replace(/_/g, " ")}</span>
                  <span className="text-white font-medium">{stage.count}</span>
                </div>
                <div className="h-7 rounded-lg bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stage.percentage}%` }}
                    transition={{ duration: 0.6 }}
                    className={cn("h-full rounded-lg flex items-center justify-end pr-2", stage.color)}
                    style={{ minWidth: stage.percentage > 0 ? "20px" : "0" }}
                  >
                    <span className="text-xs text-white font-medium">{stage.percentage}%</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-8">No lead data available yet</p>
        )}
      </div>

      {/* Sources & Performance */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Leads by Source</h2>
          {loading ? (
            <div className="animate-pulse space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-5 bg-white/10 rounded" />)}</div>
          ) : leadsBySource.length > 0 ? (
            <div className="space-y-3">
              {leadsBySource.map((s: any, i: number) => (
                <div key={s.source} className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", sourceColors[i % sourceColors.length])} />
                  <span className="text-sm text-gray-400 flex-1 capitalize">{s.source}</span>
                  <span className="text-sm text-white font-medium">{s._count?.id || 0}</span>
                  <div className="w-24 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={cn("h-full rounded-full", sourceColors[i % sourceColors.length])}
                      style={{ width: `${maxSourceCount > 0 ? ((s._count?.id || 0) / maxSourceCount) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">No source data yet</p>
          )}
        </div>

        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Key Rates</h2>
          {loading ? (
            <div className="animate-pulse space-y-4">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/10 rounded" />)}</div>
          ) : (
            <div className="space-y-5">
              {[
                { label: "Qualification Rate", value: stats?.qualifiedRate ?? 0, desc: "Leads that qualified" },
                { label: "Booking Rate", value: stats?.bookingRate ?? 0, desc: "Qualified leads that booked" },
                { label: "Show Rate", value: stats?.showRate ?? 0, desc: "Bookings that showed up" },
                { label: "Conversion Rate", value: stats?.conversionRate ?? 0, desc: "Visits that converted" },
              ].map((rate) => (
                <div key={rate.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{rate.label}</span>
                    <span className="text-white font-medium">{rate.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${rate.value}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full bg-gradient-to-r from-leadflow-500 to-leadflow-accent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{rate.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

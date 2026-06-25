"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Activity, Users, Phone, Calendar, TrendingUp, DollarSign,
  Globe, Shield, Wifi, WifiOff, Loader2, ArrowUp, ArrowDown,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [analyticsRes, healthRes, usageRes] = await Promise.all([
        api.get("/admin/analytics/dashboard").catch(() => null),
        api.get("/admin/system/health").catch(() => null),
        api.get("/admin/system/usage").catch(() => null),
      ]);
      setAnalytics(analyticsRes);
      setHealth(healthRes);
      setUsage(usageRes);
    } catch (err: any) {
      console.error("Failed to load admin dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const statCards = [
    { icon: Users, label: "Total Tenants", value: analytics?.tenants?.total ?? "—", sub: `${analytics?.tenants?.active ?? 0} active`, color: "from-blue-500 to-blue-600" },
    { icon: Activity, label: "New This Month", value: analytics?.tenants?.newThisMonth ?? "—", sub: `${analytics?.tenants?.trial ?? 0} on trial`, color: "from-violet-500 to-violet-600" },
    { icon: Phone, label: "Total Calls", value: analytics?.calls?.total ?? "—", sub: `${analytics?.calls?.today ?? 0} today`, color: "from-amber-500 to-amber-600" },
    { icon: TrendingUp, label: "Conversion", value: analytics?.leads?.conversionRate ?? "—", sub: `${analytics?.leads?.total ?? 0} total leads`, color: "from-emerald-500 to-emerald-600", suffix: "%" },
    { icon: DollarSign, label: "Monthly MRR", value: analytics?.revenue?.mrr ?? "—", sub: `${analytics?.revenue?.arr ?? 0} ARR`, color: "from-green-500 to-green-600", prefix: "₹" },
    { icon: Globe, label: "Territories", value: analytics?.territories?.occupied ?? "—", sub: `${analytics?.territories?.available ?? 0} available`, color: "from-indigo-500 to-indigo-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Platform overview and system health</p>
      </div>

      {/* System Health */}
      {!loading && health && (
        <div className={cn(
          "p-4 rounded-xl border flex items-center gap-3",
          health.status === "healthy" ? "bg-green-500/10 border-green-500/20" :
          health.status === "degraded" ? "bg-yellow-500/10 border-yellow-500/20" :
          "bg-red-500/10 border-red-500/20"
        )}>
          {health.status === "healthy" ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-yellow-400" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-white capitalize">{health.status}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
              <span className={cn("flex items-center gap-1", health.checks?.postgres === "healthy" ? "text-green-400" : "text-red-400")}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> PostgreSQL
              </span>
              <span className={cn("flex items-center gap-1", health.checks?.redis === "healthy" ? "text-green-400" : "text-red-400")}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> Redis
              </span>
            </div>
          </div>
          <span className="text-xs text-gray-500">v{health.version}</span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10"
          >
            {loading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 w-12 bg-white/10 rounded" />
                <div className="h-3 w-20 bg-white/10 rounded" />
              </div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", card.color)}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-white">
                  {card.prefix || ""}{card.value}{card.suffix || ""}
                </div>
                <div className="text-xs text-gray-500">{card.sub}</div>
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Lead & Call Metrics */}
      {!loading && analytics && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-sm font-semibold text-white mb-4">Lead Overview</h2>
            <div className="space-y-4">
              {[
                { label: "Total Leads", value: analytics.leads?.total ?? 0, max: analytics.leads?.total || 1 },
                { label: "Today", value: analytics.leads?.today ?? 0, max: analytics.leads?.total || 1 },
                { label: "This Month", value: analytics.leads?.thisMonth ?? 0, max: analytics.leads?.total || 1 },
                { label: "Converted", value: analytics.leads?.converted ?? 0, max: analytics.leads?.total || 1 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">{item.label}</span>
                    <span className="text-white font-medium">{item.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-leadflow-500 to-leadflow-accent"
                      style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-sm font-semibold text-white mb-4">Revenue</h2>
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                <div>
                  <p className="text-sm text-gray-400">Monthly Recurring Revenue</p>
                  <p className="text-2xl font-bold text-white mt-1">₹{analytics.revenue?.mrr?.toLocaleString() ?? 0}</p>
                </div>
                <ArrowUp className="w-8 h-8 text-green-400" />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/5">
                <div>
                  <p className="text-sm text-gray-400">Annual Run Rate</p>
                  <p className="text-2xl font-bold text-white mt-1">₹{analytics.revenue?.arr?.toLocaleString() ?? 0}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-leadflow-accent" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage & Engagement */}
      {!loading && usage && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-4">Usage & Engagement</h2>
          <div className="flex items-center gap-8">
            <div>
              <p className="text-sm text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-white">{usage.totalUsers}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Today</p>
              <p className="text-2xl font-bold text-white">{usage.activeUsersToday}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Engagement Rate</p>
              <p className="text-2xl font-bold text-white">{usage.engagementRate}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

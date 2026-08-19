"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2, Users, Phone, Calendar, TrendingUp, Zap, CreditCard,
  Activity, Clock, IndianRupee, Shield, AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AdminPlatformData {
  clients: { total: number; active: number };
  leads: { total: number };
  calls: { today: number; thisMonth: number };
  bookings: { total: number };
  revenue: { mrr: number; arr: number };
  credits: {
    minutesPurchased: number;
    minutesUsed: number;
    minutesRemaining: number;
    costPerMinute: number;
  } | null;
}

interface DashboardResponse {
  admin: boolean;
  platform: AdminPlatformData;
  leadsBySource: Array<{ source: string; _count: { id: number } }>;
  leadsByStatus: Array<{ status: string; _count: { id: number } }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const res = await api.get<DashboardResponse>("/dashboard");
      setData(res);
    } catch (err: any) {
      toast.error("Failed to load platform data");
    } finally {
      setLoading(false);
    }
  }

  const statCards = data ? [
    {
      title: "Total Clients",
      value: data.platform.clients.total,
      sub: `${data.platform.clients.active} active`,
      icon: Building2,
      color: "from-blue-500 to-blue-600",
    },
    {
      title: "Total Leads",
      value: data.platform.leads.total,
      sub: "Across all brokers",
      icon: Users,
      color: "from-purple-500 to-purple-600",
    },
    {
      title: "Calls Today",
      value: data.platform.calls.today,
      sub: `${data.platform.calls.thisMonth} this month`,
      icon: Phone,
      color: "from-amber-500 to-amber-600",
    },
    {
      title: "Bookings",
      value: data.platform.bookings.total,
      sub: "Total appointments",
      icon: Calendar,
      color: "from-emerald-500 to-emerald-600",
    },
    {
      title: "MRR",
      value: `₹${(data.platform.revenue.mrr / 1000).toFixed(0)}K`,
      sub: `₹${(data.platform.revenue.arr / 100000).toFixed(1)}L ARR`,
      icon: IndianRupee,
      color: "from-rose-500 to-rose-600",
    },
    {
      title: "Minutes Left",
      value: data.platform.credits?.minutesRemaining ?? 0,
      sub: `${data.platform.credits?.costPerMinute ?? 4.6}/min`,
      icon: Clock,
      color: "from-cyan-500 to-cyan-600",
    },
  ] : [];

  const totalLeads = data?.leadsByStatus.reduce((s, x) => s + (x._count?.id || 0), 0) || 0;
  const pendingCount = data?.leadsByStatus.find(s => s.status === "PENDING")?._count?.id || 0;
  const convertedCount = data?.leadsByStatus.find(s => s.status === "CONVERTED")?._count?.id || 0;
  const coldCount = data?.leadsByStatus.find(s => s.status === "COLD")?._count?.id || 0;
  const bookedCount = data?.leadsByStatus.reduce((s, x) =>
    s + (["BOOKED", "VISITED"].includes(x.status) ? (x._count?.id || 0) : 0), 0) || 0;
  const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;
  const bookingRate = totalLeads > 0 ? Math.round((bookedCount / totalLeads) * 100) : 0;

  const sourceColors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-cyan-500",
    "bg-emerald-500", "bg-orange-500", "bg-rose-500", "bg-indigo-500",
  ];
  const maxSourceCount = Math.max(...(data?.leadsBySource.map(s => s._count?.id || 0) || [0]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#F0F7F3] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#6FE3B0]" />
            Admin Dashboard
          </h1>
          <p className="text-xs text-[#9FB0A6] mt-1">
            {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-3 py-1.5 rounded-lg app-card app-card-hover text-xs text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] transition-all flex items-center gap-1.5"
        >
          <Activity className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Warning banner if demo mode or low credits */}
      {data?.platform.credits && data.platform.credits.minutesRemaining < 100 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs text-amber-300">
            <strong className="font-semibold">Low credit warning:</strong>{" "}
            Only {data.platform.credits.minutesRemaining} minutes remaining (₹{data.platform.credits.minutesRemaining * data.platform.credits.costPerMinute}).
            Buy more at <span className="font-mono">omnidim.io</span> → Record via Credits top-up.
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl app-card animate-pulse">
                <div className="h-3 w-16 bg-white/[0.06] rounded mb-3" />
                <div className="h-6 w-12 bg-white/[0.06] rounded mb-2" />
                <div className="h-2 w-20 bg-[#101713] rounded" />
              </div>
            ))
          : statCards.map((card, i) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-[#9FB0A6]">{card.title}</span>
                  <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center", card.color)}>
                    <card.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="text-lg font-bold text-[#F0F7F3]">{card.value}</div>
                <div className="text-[10px] text-[#9FB0A6] mt-0.5">{card.sub}</div>
              </motion.div>
            ))}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Funnel Overview */}
        <div className="p-5 rounded-xl app-card">
          <h3 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#6FE3B0]" />
            Lead Funnel
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-6 bg-[#101713] rounded animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Leads", value: totalLeads, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "Pending", value: pendingCount, color: "text-[#9FB0A6]", bg: "bg-gray-500/10" },
                { label: "Booked/Visited", value: bookedCount, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Converted", value: convertedCount, color: "text-green-400", bg: "bg-green-500/10" },
                { label: "Cold", value: coldCount, color: "text-red-400", bg: "bg-red-500/10" },
                { label: "Booking Rate", value: `${bookingRate}%`, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                { label: "Conversion Rate", value: `${conversionRate}%`, color: "text-purple-400", bg: "bg-purple-500/10" },
              ].map((item) => (
                <div key={item.label} className={cn("p-3 rounded-lg border border-white/10", item.bg)}>
                  <div className="text-[11px] text-[#9FB0A6]">{item.label}</div>
                  <div className={cn("text-base font-bold mt-0.5", item.color)}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Sources */}
        <div className="p-5 rounded-xl app-card">
          <h3 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#6FE3B0]" />
            Lead Sources
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-5 bg-[#101713] rounded animate-pulse" />)}</div>
          ) : data?.leadsBySource && data.leadsBySource.length > 0 ? (
            <div className="space-y-2.5">
              {data.leadsBySource.map((s, i) => (
                <div key={s.source} className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", sourceColors[i % sourceColors.length])} />
                  <span className="text-xs text-[#9FB0A6] flex-1 capitalize">{s.source || "Unknown"}</span>
                  <span className="text-xs text-[#F0F7F3] font-medium">{s._count?.id || 0}</span>
                  <div className="w-20 h-1.5 rounded-full bg-[#101713] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", sourceColors[i % sourceColors.length])}
                      style={{ width: `${((s._count?.id || 0) / maxSourceCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#9FB0A6] text-center py-6">No lead data yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Manage Brokers", href: "/dashboard/settings", icon: Building2, desc: "View & manage all brokers" },
          { label: "Credit Overview", href: "/dashboard/billing", icon: CreditCard, desc: "Check credit usage & top up" },
          { label: "All Leads", href: "/dashboard/leads", icon: Users, desc: "View platform-wide leads" },
          { label: "Analytics", href: "/dashboard/analytics", icon: TrendingUp, desc: "Deep dive analytics" },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] hover:border-[#34D399]/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#34D399]/15 flex items-center justify-center mb-3 group-hover:bg-[#34D399]/25 transition-colors">
              <action.icon className="w-4 h-4 text-[#6FE3B0]" />
            </div>
            <div className="text-sm font-medium text-[#F0F7F3] group-hover:text-[#6FE3B0] transition-colors">{action.label}</div>
            <div className="text-[11px] text-[#9FB0A6] mt-0.5">{action.desc}</div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
        <p className="text-[11px] text-gray-600">
          Running in <span className="text-[#9FB0A6] font-medium">Production Mode</span> · 
          Voice AI: <span className="text-green-400">Connected</span> · 
          <Link href="https://omnidim.io" target="_blank" className="text-[#6FE3B0] hover:underline ml-1">Buy Credits →</Link>
        </p>
      </div>
    </div>
  );
}

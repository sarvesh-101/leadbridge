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
      color: "from-warning to-warning",
    },
    {
      title: "Bookings",
      value: data.platform.bookings.total,
      sub: "Total appointments",
      icon: Calendar,
      color: "from-success to-success",
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
    "bg-blue-500", "bg-success", "bg-purple-500", "bg-cyan-500",
    "bg-success", "bg-warning", "bg-danger", "bg-indigo-500",
  ];
  const maxSourceCount = Math.max(...(data?.leadsBySource.map(s => s._count?.id || 0) || [0]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand" />
            Admin Dashboard
          </h1>
          <p className="text-xs text-ink-soft mt-1">
            {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-3 py-1.5 rounded-lg app-card app-card-hover text-xs text-ink-soft hover:bg-white/[0.06] hover:text-ink transition-all flex items-center gap-1.5"
        >
          <Activity className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Warning banner if demo mode or low credits */}
      {data?.platform.credits && data.platform.credits.minutesRemaining < 100 && (
        <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <div className="text-xs text-warning">
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
                <div className="h-2 w-20 bg-canvas rounded" />
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
                  <span className="text-[11px] font-medium text-ink-soft">{card.title}</span>
                  <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center", card.color)}>
                    <card.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="text-lg font-bold text-ink">{card.value}</div>
                <div className="text-[10px] text-ink-soft mt-0.5">{card.sub}</div>
              </motion.div>
            ))}
      </div>

      {/* Middle Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Funnel Overview */}
        <div className="p-5 rounded-xl app-card">
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand" />
            Lead Funnel
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-6 bg-canvas rounded animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Total Leads", value: totalLeads, color: "text-blue-400", bg: "bg-blue-500/10" },
                { label: "Pending", value: pendingCount, color: "text-ink-soft", bg: "bg-neutral-soft/10" },
                { label: "Booked/Visited", value: bookedCount, color: "text-success", bg: "bg-success/10" },
                { label: "Converted", value: convertedCount, color: "text-success", bg: "bg-success/10" },
                { label: "Cold", value: coldCount, color: "text-danger", bg: "bg-danger/10" },
                { label: "Booking Rate", value: `${bookingRate}%`, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                { label: "Conversion Rate", value: `${conversionRate}%`, color: "text-purple-400", bg: "bg-purple-500/10" },
              ].map((item) => (
                <div key={item.label} className={cn("p-3 rounded-lg border border-line", item.bg)}>
                  <div className="text-[11px] text-ink-soft">{item.label}</div>
                  <div className={cn("text-base font-bold mt-0.5", item.color)}>{item.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead Sources */}
        <div className="p-5 rounded-xl app-card">
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand" />
            Lead Sources
          </h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-5 bg-canvas rounded animate-pulse" />)}</div>
          ) : data?.leadsBySource && data.leadsBySource.length > 0 ? (
            <div className="space-y-2.5">
              {data.leadsBySource.map((s, i) => (
                <div key={s.source} className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", sourceColors[i % sourceColors.length])} />
                  <span className="text-xs text-ink-soft flex-1 capitalize">{s.source || "Unknown"}</span>
                  <span className="text-xs text-ink font-medium">{s._count?.id || 0}</span>
                  <div className="w-20 h-1.5 rounded-full bg-canvas overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", sourceColors[i % sourceColors.length])}
                      style={{ width: `${((s._count?.id || 0) / maxSourceCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft text-center py-6">No lead data yet</p>
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
            className="p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] hover:border-brand/40 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center mb-3 group-hover:bg-brand/25 transition-colors">
              <action.icon className="w-4 h-4 text-brand" />
            </div>
            <div className="text-sm font-medium text-ink group-hover:text-brand transition-colors">{action.label}</div>
            <div className="text-[11px] text-ink-soft mt-0.5">{action.desc}</div>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-line text-center">
        <p className="text-[11px] text-ink-soft">
          Running in <span className="text-ink-soft font-medium">Production Mode</span> · 
          Voice AI: <span className="text-success">Connected</span> · 
          <Link href="https://omnidim.io" target="_blank" className="text-brand hover:underline ml-1">Buy Credits →</Link>
        </p>
      </div>
    </div>
  );
}

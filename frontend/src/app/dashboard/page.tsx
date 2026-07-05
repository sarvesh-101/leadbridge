"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Phone, Calendar, TrendingUp, Zap, Star, ChevronRight, BrainCircuit } from "lucide-react";
import { StatCard } from "../../components/shared/StatCard";
import { LeadVolumeChart } from "../../components/dashboard/LeadVolumeChart";
import { StatusDonutChart } from "../../components/dashboard/StatusDonutChart";
import { ActivityFeed } from "../../components/dashboard/ActivityFeed";import { toast } from "sonner"
import { api } from "../../lib/api";
import { useWebSocket } from "../../lib/websocket";
import { cn } from "../../lib/utils";
import type { DashboardStats } from "../../types";
import Link from "next/link";

type ActivityType = "lead_new" | "call_started" | "call_completed" | "booking_made" | "status_change" | "notification_sent";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
}

interface ChartDataPoint {
  date: string;
  leads: number;
  calls: number;
  bookings: number;
}

interface BookingItem {
  lead?: { name?: string; source?: string };
  visitTime?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leadsByStatus, setLeadsByStatus] = useState<Array<{ status: string; _count: { id: number } }>>([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [todayBookings, setTodayBookings] = useState<BookingItem[]>([]);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [hotLeadsLoading, setHotLeadsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    loadHotLeads();
  }, []);

  async function loadDashboard() {
    try {
      const data = await api.get("/dashboard");
      setStats(data.stats);
      setLeadsByStatus(data.leadsByStatus || []);

      // Today's bookings
      setTodayBookings(data.todayBookings || []);

      // Use real daily aggregation data
      if (data.dailyActivity && data.dailyActivity.length > 0) {
        setChartData(data.dailyActivity);
      }

      // Activity feed
      setActivity(
        (data.recentActivity || []).slice(0, 10).map((lead: Record<string, unknown>, i: number) => ({
          id: `activity-${i}`,
          type: lead.status === "BOOKED" ? "booking_made" :
                 lead.status === "CALLING" ? "call_started" :
                 lead.status === "CONVERTED" ? "call_completed" : "lead_new",
          title: `${lead.name} — ${lead.status}`,
          description: `Source: ${lead.source}`,
          timestamp: (lead.updatedAt || lead.createdAt) as string,
        }))
      );
    } catch (err) {
      toast.error("Failed to load dashboard")
    } finally {
      setLoading(false);
    }
  }

  async function loadHotLeads() {
    setHotLeadsLoading(true);
    try {
      const data = await api.get("/leads?limit=100&page=1&status=all");
      const filtered = (data.leads || [])
        .filter((l: any) => !["COLD", "CONVERTED"].includes(l.status))
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);
      setHotLeads(filtered);
    } catch {
      // Silently fail — non-critical widget
    } finally {
      setHotLeadsLoading(false);
    }
  }

  // Real-time updates
  useWebSocket("lead.new", (event) => {
    setActivity((prev) => [
      {
        id: `live-${Date.now()}`,
        type: "lead_new",
        title: `${event.data.name} — New Lead`,
        description: `Source: ${event.data.source}`,
        timestamp: new Date().toISOString(),
      },
      ...prev.slice(0, 19),
    ]);
    loadDashboard();
  });

  useWebSocket("lead.status_changed", () => {
    loadDashboard();
  });

  const statCards = [
    { title: "Today's Leads", value: stats?.todayLeads ?? 0, icon: <Users />, subtitle: `${stats?.monthLeads ?? 0} this month` },
    { title: "Calls Made", value: stats?.todayCalls ?? 0, icon: <Phone />, subtitle: `${stats?.monthCalls ?? 0} this month` },
    { title: "Visits Booked", value: stats?.todayBookings ?? 0, icon: <Calendar />, subtitle: `${stats?.monthBookings ?? 0} this month` },
    { title: "Conversion", value: `${stats?.conversionRate ?? 0}%`, icon: <TrendingUp />, subtitle: `${stats?.bookingRate ?? 0}% booking rate` },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stats Row — 4 cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4"
      >
        {statCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            <StatCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              subtitle={card.subtitle}
              loading={loading}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <LeadVolumeChart data={chartData} loading={loading} />
        </div>
        <StatusDonutChart data={leadsByStatus} loading={loading} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-4 sm:p-5"
          >
            <h3 className="caption mb-4">Recent Activity</h3>
            <ActivityFeed activities={activity} loading={loading} />
          </motion.div>
        </div>

        {/* Hot Leads — High Probability */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="caption flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#22D3A5]" />
              Hot Leads
            </h3>
            <Link href="/dashboard/leads" className="text-[11px] text-[#4F6EF7] hover:text-[#4F6EF7]/80 font-medium transition-colors">
              View all
            </Link>
          </div>
          {hotLeadsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 rounded-lg bg-[#1A1A24] animate-pulse" />
              ))}
            </div>
          ) : hotLeads.length > 0 ? (
            <div className="space-y-2">
              {hotLeads.map((lead: any, i: number) => (
                <Link key={lead.id} href={`/dashboard/leads/${lead.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] hover:bg-[#1A1A24]/80 transition-all group"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold font-mono",
                    lead.score >= 80 ? "bg-[#22D3A5]/20 text-[#22D3A5]" :
                    lead.score >= 70 ? "bg-[#22D3A5]/10 text-[#22D3A5]" :
                    "bg-[#F59E0B]/10 text-[#F59E0B]"
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#F0F0F8] truncate">{lead.name}</p>
                    <p className="text-[11px] text-[#6B6B8A]">{lead.source} · Score: {lead.score}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      lead.score >= 80 ? "bg-[#22D3A5]" :
                      lead.score >= 70 ? "bg-[#22D3A5]/70" :
                      "bg-[#F59E0B]"
                    )} />
                    <ChevronRight className="w-3.5 h-3.5 text-[#3A3A52] group-hover:text-[#6B6B8A] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BrainCircuit className="w-8 h-8 text-[#3A3A52] mx-auto mb-2" />
              <p className="text-[13px] text-[#6B6B8A]">No scored leads yet</p>
              <p className="text-[11px] text-[#3A3A52] mt-1">Scores appear after AI calls complete</p>
            </div>
          )}
        </motion.div>

        {/* Today's Bookings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-5"
        >
          <h3 className="caption mb-4">Today&apos;s Visits</h3>
          {todayBookings.length > 0 ? (
            <div className="space-y-2">
              {todayBookings.map((booking: BookingItem, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A]">
                  <div className="w-2 h-2 rounded-full bg-[#22D3A5]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#F0F0F8] truncate">
                      {booking.lead?.name || "Unknown"}
                    </p>
                    <p className="text-[12px] text-[#6B6B8A]">{booking.visitTime} · {booking.lead?.source || ""}</p>
                  </div>
                  <span className="text-[11px] text-[#22D3A5] font-mono">{booking.visitTime}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[#6B6B8A] text-center py-8">
              No visits scheduled today
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

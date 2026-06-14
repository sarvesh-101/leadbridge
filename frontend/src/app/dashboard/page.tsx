"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Phone, Calendar, TrendingUp } from "lucide-react";
import { StatCard } from "../../components/shared/StatCard";
import { LeadVolumeChart } from "../../components/dashboard/LeadVolumeChart";
import { StatusDonutChart } from "../../components/dashboard/StatusDonutChart";
import { ActivityFeed } from "../../components/dashboard/ActivityFeed";
import { api } from "../../lib/api";
import { useWebSocket } from "../../lib/websocket";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [todayBookings, setTodayBookings] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const data = await api.get("/dashboard");
      setStats(data.stats);

      // Today's bookings
      setTodayBookings(data.todayBookings || []);

      // Generate chart data
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      setChartData(
        days.map((d, i) => ({
          date: d,
          leads: Math.floor((data.stats?.monthLeads || 0) / 4),
          calls: Math.floor((data.stats?.monthCalls || 0) / 4),
          bookings: Math.floor((data.stats?.monthBookings || 0) / 4),
        }))
      );

      // Activity feed
      setActivity(
        (data.recentActivity || []).slice(0, 10).map((lead: any, i: number) => ({
          id: `activity-${i}`,
          type: lead.status === "BOOKED" ? "booking_made" :
                 lead.status === "CALLING" ? "call_started" :
                 lead.status === "CONVERTED" ? "call_completed" : "lead_new",
          title: `${lead.name} — ${lead.status}`,
          description: `Source: ${lead.source}`,
          timestamp: lead.updatedAt || lead.createdAt,
        }))
      );
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
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
        className="grid grid-cols-2 xl:grid-cols-4 gap-4"
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
        <StatusDonutChart data={stats?.leadsByStatus || []} loading={loading} />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-5"
          >
            <h3 className="caption mb-4">Recent Activity</h3>
            <ActivityFeed activities={activity} loading={loading} />
          </motion.div>
        </div>

        {/* Today's Bookings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-5"
        >
          <h3 className="caption mb-4">Today&apos;s Visits</h3>
          {todayBookings.length > 0 ? (
            <div className="space-y-2">
              {todayBookings.map((booking: any, i: number) => (
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

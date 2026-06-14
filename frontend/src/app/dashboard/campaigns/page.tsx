"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Plus, Play, Pause, Target, Users, Phone, MessageSquare, Clock, BarChart3 } from "lucide-react";

const WORKFLOW_TASKS = [
  { order: 1, action: "delay", label: "Wait 24h", icon: Clock, color: "text-yellow-400" },
  { order: 2, action: "call", label: "AI Call", icon: Phone, color: "text-green-400" },
  { order: 3, action: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "text-blue-400" },
  { order: 4, action: "condition", label: "Booked?", icon: Target, color: "text-purple-400" },
  { order: 5, action: "call", label: "Follow-up", icon: Phone, color: "text-green-400" },
];

export default function CampaignsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await api.get("/dashboard");
      setStats(data.stats);
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }

  const campaigns = [
    {
      id: "1",
      name: "No-Show Recovery",
      type: "Automated",
      status: "active",
      leads: stats?.todayBookings || 0,
      calls: stats?.todayCalls || 0,
      messages: stats?.activeFollowups || 0,
      conversions: stats?.conversionRate ? Math.round(stats.totalLeads * stats.conversionRate / 100) : 0,
      rate: stats?.conversionRate || 0,
    },
    {
      id: "2",
      name: "New Lead Welcome",
      type: "Automated",
      status: "active",
      leads: stats?.monthLeads || 0,
      calls: Math.round((stats?.monthLeads || 0) * 0.8),
      messages: Math.round((stats?.monthLeads || 0) * 0.6),
      conversions: stats?.qualifiedRate ? Math.round(stats.monthLeads * stats.qualifiedRate / 100) : 0,
      rate: stats?.qualifiedRate || 0,
    },
    {
      id: "3",
      name: "Follow-up Sequence",
      type: "Automated",
      status: "active",
      leads: stats?.activeFollowups || 0,
      calls: Math.round((stats?.activeFollowups || 0) * 1.5),
      messages: stats?.activeFollowups || 0,
      conversions: stats?.bookingRate ? Math.round((stats?.activeFollowups || 0) * stats.bookingRate / 100) : 0,
      rate: stats?.bookingRate || 0,
    },
    {
      id: "4",
      name: "Bulk Outreach",
      type: "Manual",
      status: "draft",
      leads: 0, calls: 0, messages: 0, conversions: 0, rate: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Automated follow-up workflows</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "In Campaigns", value: loading ? "—" : stats?.totalLeads || 0, color: "text-blue-400" },
          { icon: Phone, label: "Auto-Calls", value: loading ? "—" : stats?.monthCalls || 0, color: "text-green-400" },
          { icon: BarChart3, label: "Conv. Rate", value: loading ? "—" : `${stats?.conversionRate || 0}%`, color: "text-emerald-400" },
          { icon: Target, label: "Active Follow-ups", value: loading ? "—" : stats?.activeFollowups || 0, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            {loading ? (
              <div className="animate-pulse"><div className="h-7 w-12 bg-white/10 rounded" /></div>
            ) : (
              <>
                <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Workflow Visual */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-4">No-Show Recovery Workflow</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {WORKFLOW_TASKS.map((task, i) => (
            <div key={task.order} className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 whitespace-nowrap">
                <task.icon className={cn("w-4 h-4", task.color)} />
                <span className="text-xs text-gray-300">{task.label}</span>
              </div>
              {i < WORKFLOW_TASKS.length - 1 && <div className="w-6 h-px bg-gray-600 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      <div className="space-y-3">
        {campaigns.map((camp, i) => (
          <motion.div key={camp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-leadflow-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">{camp.name}</span>
                  <span className="text-xs text-gray-500">{camp.type}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full",
                    camp.status === "active" ? "bg-green-500/10 text-green-400" :
                    camp.status === "draft" ? "bg-gray-500/10 text-gray-400" : "bg-yellow-500/10 text-yellow-400"
                  )}>{camp.status}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {camp.leads}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {camp.calls}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {camp.messages}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <div className="flex items-center gap-2 sm:text-right">
                <div className="text-sm font-semibold text-green-400">{camp.conversions}</div>
                <div className="text-xs text-gray-500">{camp.rate}% conv.</div>
              </div>
              <button className={cn("p-2 rounded-lg transition-colors",
                camp.status === "active" ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" :
                "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
              )}>
                {camp.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Play, Pause, Target, Users, Phone, MessageSquare, Clock, BarChart3, X, Loader2 } from "lucide-react";
import type { Campaign, CampaignStatus, CampaignType } from "@/types";

const WORKFLOW_TASKS = [
  { order: 1, action: "delay", label: "Wait 24h", icon: Clock, color: "text-yellow-400" },
  { order: 2, action: "call", label: "AI Call", icon: Phone, color: "text-green-400" },
  { order: 3, action: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "text-blue-400" },
  { order: 4, action: "condition", label: "Booked?", icon: Target, color: "text-purple-400" },
  { order: 5, action: "call", label: "Follow-up", icon: Phone, color: "text-green-400" },
];

const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "RE_ENGAGEMENT", label: "Re-engagement" },
  { value: "NO_SHOW_RECOVERY", label: "No-Show Recovery" },
  { value: "WELCOME", label: "Welcome" },
  { value: "PROMOTIONAL", label: "Promotional" },
  { value: "CUSTOM", label: "Custom" },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CampaignType>("FOLLOW_UP");
  const [newDescription, setNewDescription] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [campaignsRes, analyticsRes] = await Promise.all([
        api.get<{ campaigns: Campaign[] }>("/campaigns"),
        api.get("/campaigns/analytics/summary").catch(() => null),
      ]);
      setCampaigns(campaignsRes.campaigns);
      setAnalytics(analyticsRes);
    } catch (err: any) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreate() {
    if (!newName.trim()) return toast.error("Campaign name is required");
    setActionLoading("create");
    try {
      const res = await api.post<{ campaign: Campaign }>("/campaigns", {
        name: newName,
        campaignType: newType,
        description: newDescription || undefined,
      });
      setCampaigns(prev => [res.campaign, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewType("FOLLOW_UP");
      toast.success(`Campaign "${res.campaign.name}" created`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleStatus(campaign: Campaign) {
    const isActive = campaign.status === "ACTIVE";
    const action = isActive ? "pause" : "activate";
    setActionLoading(`${action}-${campaign.id}`);
    try {
      if (isActive) {
        await api.post(`/campaigns/${campaign.id}/pause`);
        toast.success("Campaign paused");
      } else {
        await api.post(`/campaigns/${campaign.id}/activate`);
        toast.success("Campaign activated");
      }
      await loadData();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} campaign`);
    } finally {
      setActionLoading(null);
    }
  }

  const statusColor = (status: CampaignStatus) => {
    switch (status) {
      case "ACTIVE": return "bg-green-500/10 text-green-400";
      case "PAUSED": return "bg-yellow-500/10 text-yellow-400";
      case "DRAFT": return "bg-gray-500/10 text-gray-400";
      case "COMPLETED": return "bg-blue-500/10 text-blue-400";
      case "ARCHIVED": return "bg-white/5 text-gray-500";
      default: return "bg-gray-500/10 text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Automated follow-up workflows</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Total Campaigns", value: loading ? "—" : campaigns.length, color: "text-blue-400" },
          { icon: Play, label: "Active", value: loading ? "—" : campaigns.filter(c => c.status === "ACTIVE").length, color: "text-green-400" },
          { icon: BarChart3, label: "Conversions", value: loading ? "—" : analytics?.conversions ?? 0, color: "text-emerald-400" },
          { icon: Target, label: "Conv. Rate", value: loading ? "—" : `${analytics?.conversionRate ?? 0}%`, color: "text-purple-400" },
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
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <Target className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create your first automated follow-up workflow</p>
          <button onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Create Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((camp, i) => (
            <motion.div key={camp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-leadflow-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{camp.name}</span>
                    <span className="text-xs text-gray-500">{camp.campaignType.replace(/_/g, " ")}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", statusColor(camp.status))}>
                      {camp.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {camp.leadsProcessed}/{camp.leadsTargeted}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {camp.callsMade}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {camp.messagesSent}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <div className="flex items-center gap-2 sm:text-right">
                  <div className="text-sm font-semibold text-green-400">{camp.conversions}</div>
                  <div className="text-xs text-gray-500">
                    {camp.leadsProcessed > 0 ? Math.round((camp.conversions / camp.leadsProcessed) * 100) : 0}% conv.
                  </div>
                </div>
                <button
                  onClick={() => handleToggleStatus(camp)}
                  disabled={actionLoading === `pause-${camp.id}` || actionLoading === `activate-${camp.id}` || camp.status === "COMPLETED" || camp.status === "ARCHIVED"}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    camp.status === "ACTIVE" ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" :
                    camp.status === "PAUSED" || camp.status === "DRAFT" ? "bg-gray-500/10 text-gray-400 hover:bg-gray-500/20" :
                    "bg-white/5 text-gray-600 cursor-not-allowed"
                  )}
                >
                  {actionLoading === `pause-${camp.id}` || actionLoading === `activate-${camp.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : camp.status === "ACTIVE" ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Create Campaign</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Campaign Name</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., No-Show Recovery"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Campaign Type</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value as CampaignType)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50"
                  >
                    {CAMPAIGN_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Description (optional)</label>
                  <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe the campaign goal..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                >
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={!newName.trim() || actionLoading === "create"}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading === "create" ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Campaign"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

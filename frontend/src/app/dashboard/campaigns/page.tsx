"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Play, Pause, Target, Users, Phone, MessageSquare, Clock, BarChart3, X, Loader2, Trash2, Edit3, AlertTriangle } from "lucide-react";
import type { Campaign, CampaignStatus, CampaignType, TaskAction } from "@/types";


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

  // Edit/Create modal
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CampaignType>("FOLLOW_UP");
  const [newDescription, setNewDescription] = useState("");

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<{ campaignId: string; taskId: string } | null>(null);

  // Local task deletion from the campaign card inline
  async function handleDeleteTaskInline(campaignId: string, taskId: string) {
    setActionLoading(`delete-task-${taskId}`);
    try {
      await api.delete(`/campaigns/${campaignId}/tasks/${taskId}`);
      toast.success("Task deleted");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task");
    } finally {
      setActionLoading(null);
      setDeleteTaskConfirm(null);
    }
  }

  // Task editor state
  const [tasks, setTasks] = useState<Array<{
    name: string;
    action: TaskAction;
    order: number;
    delayHours?: number;
    delayMinutes?: number;
    isCondition?: boolean;
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: string;
    config?: Record<string, unknown>;
  }>>([]);

  const TASK_ACTIONS: { value: TaskAction; label: string; icon: React.ElementType; color: string }[] = [
    { value: "CALL", label: "AI Call", icon: Phone, color: "text-green-400" },
    { value: "WHATSAPP", label: "WhatsApp", icon: MessageSquare, color: "text-blue-400" },
    { value: "SMS", label: "SMS", icon: MessageSquare, color: "text-purple-400" },
    { value: "EMAIL", label: "Email", icon: MessageSquare, color: "text-amber-400" },
    { value: "DELAY", label: "Delay", icon: Clock, color: "text-yellow-400" },
    { value: "CONDITION", label: "Condition", icon: Target, color: "text-red-400" },
    { value: "UPDATE_LEAD_STATUS", label: "Update Status", icon: Target, color: "text-indigo-400" },
    { value: "WEBHOOK", label: "Webhook", icon: Target, color: "text-cyan-400" },
    { value: "CUSTOM", label: "Custom", icon: Target, color: "text-gray-400" },
  ];

  function getTaskMeta(action: TaskAction) {
    return TASK_ACTIONS.find(t => t.value === action) || TASK_ACTIONS[TASK_ACTIONS.length - 1];
  }

  function addTask() {
    setTasks(prev => [...prev, {
      name: "",
      action: "CALL",
      order: prev.length + 1,
      delayHours: 0,
    }]);
  }

  function removeTask(index: number) {
    setTasks(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((t, i) => ({ ...t, order: i + 1 }));
    });
  }

  function updateTask(index: number, updates: Partial<typeof tasks[0]>) {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
  }

  function moveTask(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tasks.length) return;
    setTasks(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated.map((t, i) => ({ ...t, order: i + 1 }));
    });
  }

  const loadData = useCallback(async () => {
    try {
      const [campaignsRes, analyticsRes] = await Promise.all([
        api.get<{ campaigns: Campaign[] }>("/campaigns"),
        api.get("/campaigns/analytics/summary").catch(() => null),
      ]);
      setCampaigns(campaignsRes.campaigns);
      setAnalytics(analyticsRes);
    } catch (err: any) {
      toast.error("Failed to load campaigns")
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleCreate() {
    if (!newName.trim()) return toast.error("Campaign name is required");
    setActionLoading("create");
    try {
      // First create the campaign
      const res = await api.post<{ campaign: Campaign }>("/campaigns", {
        name: newName,
        campaignType: newType,
        description: newDescription || undefined,
      });
      const campaignId = res.campaign.id;

      // Then create each task
      for (const task of tasks) {
        await api.post(`/campaigns/${campaignId}/tasks`, {
          name: task.name || `${getTaskMeta(task.action).label} ${task.order}`,
          action: task.action,
          order: task.order,
          delayAfterPreviousHours: task.delayHours || 0,
          delayAfterPreviousMinutes: task.delayMinutes || 0,
          isCondition: task.isCondition || false,
          conditionField: task.conditionField || null,
          conditionOperator: task.conditionOperator || null,
          conditionValue: task.conditionValue || null,
          config: task.config || {},
        });
      }

      toast.success(`Campaign "${res.campaign.name}" created with ${tasks.length} tasks`);
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewType("FOLLOW_UP");
      setTasks([]);
      await loadData();
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

  async function openCreateModal() {
    setEditingCampaign(null);
    setNewName("");
    setNewType("FOLLOW_UP");
    setNewDescription("");
    setTasks([]);
    setShowCreate(true);
  }

  function openEditModal(campaign: Campaign) {
    setEditingCampaign(campaign);
    setNewName(campaign.name);
    setNewType(campaign.campaignType);
    setNewDescription(campaign.description || "");
    setTasks(campaign.tasks.map(t => ({
      name: t.name,
      action: t.action,
      order: t.order,
      delayHours: t.delayAfterPreviousHours || 0,
      delayMinutes: t.delayAfterPreviousMinutes || 0,
      isCondition: t.isCondition || false,
      conditionField: t.conditionField || "",
      conditionOperator: t.conditionOperator || "equals",
      conditionValue: t.conditionValue || "",
      config: t.config || {},
    })));
    setShowCreate(true);
  }

  async function handleSaveEdit() {
    if (!editingCampaign || !newName.trim()) return toast.error("Campaign name is required");
    setActionLoading("save-edit");
    try {
      await api.patch(`/campaigns/${editingCampaign.id}`, {
        name: newName,
        campaignType: newType,
        description: newDescription || undefined,
      });

      // Update tasks: delete existing sequentially, then recreate
      // Sequential deletion ensures we catch failures and don't leave a half-deleted state
      for (const t of editingCampaign.tasks) {
        await api.delete(`/campaigns/${editingCampaign.id}/tasks/${t.id}`);
      }

      // Then create new tasks
      for (const task of tasks) {
        await api.post(`/campaigns/${editingCampaign.id}/tasks`, {
          name: task.name || `${getTaskMeta(task.action).label} ${task.order}`,
          action: task.action,
          order: task.order,
          delayAfterPreviousHours: task.delayHours || 0,
          delayAfterPreviousMinutes: task.delayMinutes || 0,
          isCondition: task.isCondition || false,
          conditionField: task.conditionField || null,
          conditionOperator: task.conditionOperator || null,
          conditionValue: task.conditionValue || null,
          config: task.config || {},
        });
      }

      toast.success(`Campaign "${newName}" updated`);
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update campaign");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteCampaign(campaignId: string) {
    setActionLoading(`delete-${campaignId}`);
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success("Campaign deleted");
      setShowCreate(false);
      setDeleteConfirmId(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete campaign");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-gray-400 mt-1">Automated follow-up workflows</p>
        </div>
        <button onClick={openCreateModal}
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

      {/* Workflow Visual — dynamic from campaigns with tasks */}
      {campaigns.some(c => c.tasks.length > 0) && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-4">Active Workflows</h2>
          <div className="space-y-4">
            {campaigns.filter(c => c.tasks.length > 0 && c.status === "ACTIVE").slice(0, 3).map(camp => (
              <div key={camp.id}>
                <p className="text-xs text-gray-500 mb-2">{camp.name}</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {camp.tasks.sort((a, b) => a.order - b.order).map((task, i, arr) => {
                    const meta = getTaskMeta(task.action);
                    return (
                      <div key={task.id} className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 whitespace-nowrap">
                          <meta.icon className={cn("w-4 h-4", meta.color)} />
                          <span className="text-xs text-gray-300">{task.name || meta.label}</span>
                          {task.delayAfterPreviousHours && task.delayAfterPreviousHours > 0 && (
                            <span className="text-[10px] text-gray-500">{task.delayAfterPreviousHours}h</span>
                          )}
                        </div>
                        {i < arr.length - 1 && <div className="w-4 h-px bg-gray-600 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <button onClick={openCreateModal}
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
              onClick={() => openEditModal(camp)}
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
                  {/* Inline task list with delete buttons */}
                  {camp.tasks && camp.tasks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {camp.tasks.sort((a, b) => a.order - b.order).map(task => {
                        const taskMeta = getTaskMeta(task.action);
                        return (
                          <div key={task.id} className="group/task inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-gray-400">
                            <taskMeta.icon className={cn("w-3 h-3", taskMeta.color)} />
                            <span className="truncate max-w-[80px]">{task.name || taskMeta.label}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTaskConfirm({ campaignId: camp.id, taskId: task.id });
                              }}
                              className="ml-0.5 opacity-0 group-hover/task:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-red-400 transition-all"
                              title="Delete task"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 sm:text-right">
                  <div className="text-sm font-semibold text-green-400">{camp.conversions}</div>
                  <div className="text-xs text-gray-500">
                    {camp.leadsProcessed > 0 ? Math.round((camp.conversions / camp.leadsProcessed) * 100) : 0}% conv.
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(camp); }}
                    className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                    title="Edit campaign"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(camp.id); }}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleStatus(camp); }}
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
              className="w-full max-w-2xl mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h2 className="text-lg font-semibold text-white">
                  {editingCampaign ? 'Edit Campaign' : 'Create Campaign'}
                </h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                {/* Campaign Details */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
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
                      rows={1}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50 resize-none"
                    />
                  </div>
                </div>

                {/* Task Editor */}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">Workflow Tasks</h3>
                    <button onClick={addTask}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-leadflow-500/10 border border-leadflow-500/30 text-leadflow-accent text-xs font-medium hover:bg-leadflow-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Step
                    </button>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="py-6 text-center">
                      <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No workflow steps yet. Add steps to define your campaign.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task, index) => {
                        const meta = getTaskMeta(task.action);
                        const isLast = index === tasks.length - 1;
                        const isFirst = index === 0;
                        return (
                          <div key={index}>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                              {/* Order number */}
                              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                <span className="text-xs font-mono text-gray-400">{task.order}</span>
                              </div>

                              {/* Task content */}
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={task.action}
                                    onChange={(e) => updateTask(index, { action: e.target.value as TaskAction })}
                                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                                  >
                                    {TASK_ACTIONS.map(a => (
                                      <option key={a.value} value={a.value}>{a.label}</option>
                                    ))}
                                  </select>

                                  {task.action !== "CONDITION" && (
                                    <input value={task.name} onChange={(e) => updateTask(index, { name: e.target.value })}
                                      placeholder={`${meta.label} name`}
                                      className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50 min-w-0"
                                    />
                                  )}
                                </div>

                                {/* Action-specific config */}
                                {task.action === "DELAY" && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Wait</span>
                                    <input type="number" min={0} value={task.delayHours || 0}
                                      onChange={(e) => updateTask(index, { delayHours: parseInt(e.target.value) || 0 })}
                                      className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white text-center"
                                    />
                                    <span className="text-xs text-gray-500">hours</span>
                                    <input type="number" min={0} max={59} value={task.delayMinutes || 0}
                                      onChange={(e) => updateTask(index, { delayMinutes: parseInt(e.target.value) || 0 })}
                                      className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white text-center"
                                    />
                                    <span className="text-xs text-gray-500">min</span>
                                  </div>
                                )}

                                {task.action === "CONDITION" && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-gray-500">If</span>
                                    <input value={task.conditionField || ""}
                                      onChange={(e) => updateTask(index, { conditionField: e.target.value })}
                                      placeholder="field"
                                      className="w-24 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500"
                                    />
                                    <select value={task.conditionOperator || "equals"}
                                      onChange={(e) => updateTask(index, { conditionOperator: e.target.value })}
                                      className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                                    >
                                      <option value="equals">equals</option>
                                      <option value="not_equals">not equals</option>
                                      <option value="contains">contains</option>
                                      <option value="greater_than">&gt;</option>
                                      <option value="less_than">&lt;</option>
                                    </select>
                                    <input value={task.conditionValue || ""}
                                      onChange={(e) => updateTask(index, { conditionValue: e.target.value })}
                                      placeholder="value"
                                      className="w-24 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500"
                                    />
                                    <label className="flex items-center gap-1 text-xs text-gray-500">
                                      <input type="checkbox" checked={task.isCondition || false}
                                        onChange={(e) => updateTask(index, { isCondition: e.target.checked })}
                                        className="rounded"
                                      />
                                      Branch
                                    </label>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => moveTask(index, -1)} disabled={isFirst}
                                  className="p-1 rounded hover:bg-white/5 text-gray-500 disabled:opacity-30"
                                  title="Move up"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button onClick={() => moveTask(index, 1)} disabled={isLast}
                                  className="p-1 rounded hover:bg-white/5 text-gray-500 disabled:opacity-30"
                                  title="Move down"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                <button onClick={() => removeTask(index)}
                                  className="p-1 rounded hover:bg-red-500/10 text-red-400"
                                  title="Remove"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Connector line between tasks */}
                            {!isLast && (
                              <div className="flex justify-center py-1">
                                <div className="w-px h-3 bg-white/10" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/10 shrink-0">
                {editingCampaign ? (
                  <>
                    <button
                      onClick={() => { setDeleteConfirmId(editingCampaign.id); }}
                      className="px-4 py-2.5 rounded-xl border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4 inline-block mr-1.5" />
                      Delete
                    </button>
                    <button onClick={() => setShowCreate(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button onClick={handleSaveEdit} disabled={!newName.trim() || actionLoading === "save-edit"}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {actionLoading === "save-edit" ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : (
                        <><Loader2 className="w-4 h-4" /> Save Changes</>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setShowCreate(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                    >
                      Cancel
                    </button>
                    <button onClick={handleCreate} disabled={!newName.trim() || actionLoading === "create"}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {actionLoading === "create" ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                      ) : (
                        <><Plus className="w-4 h-4" /> Create with {tasks.length} step{tasks.length !== 1 ? "s" : ""}</>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Campaign Confirmation */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Delete Campaign?</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCampaign(deleteConfirmId)}
                  disabled={actionLoading === `delete-${deleteConfirmId}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  {actionLoading === `delete-${deleteConfirmId}` ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Delete</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Task Confirmation */}
      <AnimatePresence>
        {deleteTaskConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteTaskConfirm(null)}
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Delete Task?</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Remove this step from the workflow.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setDeleteTaskConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTaskInline(deleteTaskConfirm.campaignId, deleteTaskConfirm.taskId)}
                  disabled={actionLoading === `delete-task-${deleteTaskConfirm.taskId}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  {actionLoading === `delete-task-${deleteTaskConfirm.taskId}` ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Delete</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

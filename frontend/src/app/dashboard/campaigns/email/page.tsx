"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Send, FileText, BarChart3, Clock, Target, Loader2, X, Mail, Eye, MousePointerClick, TrendingUp, Users, Search, CheckSquare, Square, SlidersHorizontal, Calendar, FlaskConical, SplitSquareHorizontal } from "lucide-react";

interface Lead {
  id: string; name: string; phone: string; email?: string; source: string;
  status: string; score: number; location?: string; receivedAt: string;
}

interface CampaignAnalytics {
  total: number;
  summary: { totalSent: number; totalFailed: number; totalOpened: number; totalClicked: number; avgDeliveryRate: number; avgOpenRate: number; avgClickRate: number };
  campaigns: Array<{
    id: string; name: string; subject: string; status: string;
    totalRecipients: number; deliveredCount: number; failedCount: number;
    openedCount: number; clickedCount: number;
    sentAt: string; createdAt: string;
  }>;
}

export default function EmailCampaignsPage() {
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  // Compose form
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Lead selector
  const [composeStep, setComposeStep] = useState<"compose" | "leads">("compose");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [leadPage, setLeadPage] = useState(1);
  const [leadTotal, setLeadTotal] = useState(0);

  // Scheduling
  const [scheduledAt, setScheduledAt] = useState("");
  const [enableScheduling, setEnableScheduling] = useState(false);

  // A/B Testing
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [variantSubject, setVariantSubject] = useState("");
  const [variantBody, setVariantBody] = useState("");
  const [samplePercent, setSamplePercent] = useState(20);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [analyticsRes, templatesRes] = await Promise.all([
        api.get("/campaigns/email/analytics"),
        api.get("/campaigns/email/templates").catch(() => ({ templates: [] })),
      ]);
      setAnalytics(analyticsRes);
      setTemplates(templatesRes.templates || []);
    } catch (err: any) {
      toast.error("Failed to load email data");
    } finally {
      setLoading(false);
    }
  }

  function applyTemplate(template: any) {
    setSubject(template.subject);
    setBody(template.body);
    setSelectedTemplate(template.name);
    setPreviewHtml(template.body.replace(/{{leadName}}/g, "[Lead Name]").replace(/{{location}}/g, "[Location]").replace(/{{businessName}}/g, "[Your Business]").replace(/{{dashboardUrl}}/g, "#"));
    toast.success(`Template "${template.name}" applied`);
  }

  async function loadLeads(search = "", page = 1) {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (search) params.set("search", search);
      const data = await api.get(`/leads?${params.toString()}`);
      setLeads(data.leads || []);
      setLeadTotal(data.total || 0);
    } catch { /* ignore */ } finally {
      setLeadsLoading(false);
    }
  }

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllLeads() {
    const allIds = leads.map((l) => l.id);
    setSelectedLeadIds((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) {
        // Deselect all on current page
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      } else {
        // Select all on current page
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }

  function openLeadSelector() {
    loadLeads(leadSearch, 1);
    setComposeStep("leads");
  }

  async function handleSend() {
    if (!name.trim()) return toast.error("Campaign name required");
    if (!subject.trim()) return toast.error("Subject required");
    if (!body.trim()) return toast.error("Email body required");

    if (selectedLeadIds.size === 0) {
      return toast.error("Select at least one lead to send to");
    }

    if (abTestEnabled && (!variantSubject.trim() || !variantBody.trim())) {
      return toast.error("Fill in both subject and body for variant B");
    }

    setActionLoading("send");
    try {
      const payload: any = {
        name,
        subject,
        body,
        targetLeadIds: Array.from(selectedLeadIds),
        scheduledAt: enableScheduling && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      };
      if (abTestEnabled) {
        payload.abTest = {
          enabled: true,
          variantSubject,
          variantBody,
          samplePercent,
        };
      }
      const res = await api.post("/campaigns/email/send", payload);
      const msg = abTestEnabled
        ? `A/B test launched! ${res.queued} sample emails queued (${samplePercent}% each variant)`
        : enableScheduling
        ? `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}`
        : `Campaign queued! ${res.queued} emails enqueued, ${res.skipped} skipped`;
      toast.success(msg);
      setShowCompose(false);
      setName(""); setSubject(""); setBody(""); setSelectedTemplate("");
      setSelectedLeadIds(new Set());
      setComposeStep("compose");
      setLeadSearch("");
      setEnableScheduling(false); setScheduledAt("");
      setAbTestEnabled(false); setVariantSubject(""); setVariantBody(""); setSamplePercent(20);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to send campaign");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Campaigns</h1>
          <p className="text-gray-400 mt-1">Send marketing emails to your leads</p>
        </div>
        <button onClick={() => { setShowCompose(true); setSelectedLeadIds(new Set()); setComposeStep("compose"); setLeadSearch(""); setEnableScheduling(false); setScheduledAt(""); setAbTestEnabled(false); setVariantSubject(""); setVariantBody(""); setSamplePercent(20); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Compose Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? (
          [1,2,3,4,5,6].map(i => <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)
        ) : (
          <>
            {[
              { icon: Mail, label: "Campaigns", value: analytics?.total ?? 0, color: "text-blue-400" },
              { icon: Send, label: "Sent", value: analytics?.summary?.totalSent ?? 0, color: "text-green-400" },
              { icon: BarChart3, label: "Delivery", value: `${analytics?.summary?.avgDeliveryRate ?? 0}%`, color: "text-emerald-400" },
              { icon: Eye, label: "Opens", value: `${analytics?.summary?.avgOpenRate ?? 0}%`, color: "text-violet-400" },
              { icon: MousePointerClick, label: "Clicks", value: `${analytics?.summary?.avgClickRate ?? 0}%`, color: "text-amber-400" },
              { icon: Clock, label: "Failed", value: analytics?.summary?.totalFailed ?? 0, color: "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Templates */}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Templates</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {templates.map((t: any, i: number) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => applyTemplate(t)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-leadflow-accent" />
                  <h3 className="text-sm font-medium text-white">{t.name}</h3>
                </div>
                <p className="text-xs text-gray-500 mb-2 truncate">{t.subject}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Eye className="w-3 h-3" /> Click to apply
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign History */}
      {!loading && analytics && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Campaign History</h2>
            {analytics.campaigns?.length > 0 && (
              <span className="text-xs text-gray-500">{analytics.campaigns.length} campaigns</span>
            )}
          </div>
          {analytics.campaigns?.length === 0 ? (
            <div className="text-center py-8 rounded-xl bg-white/5 border border-white/10">
              <Mail className="w-8 h-8 text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No campaigns sent yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {analytics.campaigns?.map((camp: any) => {
                const openRate = camp.deliveredCount > 0 ? Math.round((camp.openedCount / camp.deliveredCount) * 100) : 0;
                const clickRate = camp.deliveredCount > 0 ? Math.round((camp.clickedCount / camp.deliveredCount) * 100) : 0;
                return (
                  <div key={camp.id} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-leadflow-500/10 flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-leadflow-accent" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{camp.name}</p>
                          <p className="text-xs text-gray-500 truncate">{camp.subject} · {camp.totalRecipients} recipients</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs shrink-0">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full",
                          camp.status === "SENT" ? "bg-green-500/10 text-green-400" :
                          camp.status === "SENDING" ? "bg-blue-500/10 text-blue-400" :
                          camp.status === "SCHEDULED" ? "bg-yellow-500/10 text-yellow-400" :
                          "bg-gray-500/10 text-gray-400"
                        )}>{camp.status}</span>
                        <span className="text-gray-500">{camp.deliveredCount}/{camp.totalRecipients}</span>
                      </div>
                    </div>
                    {/* Tracking metrics bar */}
                    <div className="flex items-center gap-4 text-xs ml-11">
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-gray-400">{camp.openedCount} opens</span>
                        <span className={cn("font-medium", openRate > 20 ? "text-green-400" : "text-gray-500")}>({openRate}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-gray-400">{camp.clickedCount} clicks</span>
                        <span className={cn("font-medium", clickRate > 10 ? "text-green-400" : "text-gray-500")}>({clickRate}%)</span>
                      </div>
                      {camp.status === "SENDING" && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Compose Email Campaign</h2>
              <button onClick={() => setShowCompose(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {composeStep === "leads" ? (
              // Lead Selection Step
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Select Leads ({selectedLeadIds.size} selected)
                  </h3>
                  <button onClick={() => setComposeStep("compose")}
                    className="text-xs text-leadflow-accent hover:underline"
                  >
                    Back to compose
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input value={leadSearch} onChange={(e) => { setLeadSearch(e.target.value); loadLeads(e.target.value, 1); }}
                    placeholder="Search leads..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <button onClick={selectAllLeads} className="flex items-center gap-1.5 hover:text-white transition-colors">
                    {leads.every((l) => selectedLeadIds.has(l.id)) ? (
                      <CheckSquare className="w-4 h-4 text-leadflow-accent" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    Select all on page
                  </button>
                  <span>{leadTotal} total leads</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1 -mx-2 px-2">
                  {leadsLoading ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 rounded-lg bg-white/5 border border-white/10 animate-pulse" />
                    ))
                  ) : leads.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">No leads found</div>
                  ) : (
                    leads.map((lead) => {
                      const isSelected = selectedLeadIds.has(lead.id);
                      return (
                        <button key={lead.id} onClick={() => toggleLead(lead.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                            isSelected
                              ? "bg-leadflow-500/10 border border-leadflow-500/30"
                              : "bg-white/5 border border-white/5 hover:bg-white/10"
                          )}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-leadflow-accent shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white truncate">{lead.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                              {lead.phone} · {lead.source} · {lead.email || "no email"}
                            </div>
                          </div>
                          {lead.score > 0 && (
                            <span className={cn(
                              "text-xs font-medium px-1.5 py-0.5 rounded shrink-0",
                              lead.score >= 70 ? "text-green-400 bg-green-500/10" :
                              lead.score >= 40 ? "text-yellow-400 bg-yellow-500/10" :
                              "text-gray-500 bg-gray-500/10"
                            )}>{lead.score}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Pagination */}
                {leadTotal > 50 && (
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3].map((p) => {
                      if (p * 50 > leadTotal + 50) return null;
                      return (
                        <button key={p} onClick={() => { setLeadPage(p); loadLeads(leadSearch, p); }}
                          className={cn(
                            "px-3 py-1 rounded-lg text-xs",
                            leadPage === p ? "bg-leadflow-500 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
                          )}
                        >{p}</button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button onClick={() => { setComposeStep("compose"); }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                  >Back</button>
                  <button onClick={handleSend} disabled={selectedLeadIds.size === 0 || actionLoading === "send"}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {actionLoading === "send" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending to {selectedLeadIds.size}...</>
                    ) : (
                      <><Send className="w-4 h-4" /> Send to {selectedLeadIds.size} leads</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // Compose Step
              <div className="space-y-4">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Campaign name"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                />
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                />
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">Email Body (HTML)</label>
                    {selectedTemplate && (
                      <span className="text-xs text-leadflow-accent">Template: {selectedTemplate}</span>
                    )}
                  </div>
                  <textarea value={body} onChange={(e) => setBody(e.target.value)}
                    placeholder="<h1>Your HTML email here</h1><p>Use {{leadName}}, {{location}}, {{businessName}} as placeholders</p>"
                    rows={10}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50 font-mono"
                  />
                </div>

                {/* Preview */}
                {previewHtml && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500">Preview</span>
                    </div>
                    <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Available variables: <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{leadName}}`}</code>, <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{location}}`}</code>, <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{businessName}}`}</code>, <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{dashboardUrl}}`}</code>
                </p>

                {/* Scheduling Toggle */}
                <div className="border-t border-white/10 pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={enableScheduling} onChange={(e) => setEnableScheduling(e.target.checked)}
                      className="rounded border-[#2A2A3A] bg-[#1A1A24] text-leadflow-accent"
                    />
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-300">Schedule for later</span>
                  </label>
                  {enableScheduling && (
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                      className="mt-2 w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                    />
                  )}
                </div>

                {/* A/B Testing Toggle */}
                <div className="border-t border-white/10 pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={abTestEnabled} onChange={(e) => setAbTestEnabled(e.target.checked)}
                      className="rounded border-[#2A2A3A] bg-[#1A1A24] text-leadflow-accent"
                    />
                    <FlaskConical className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-gray-300">A/B Test — send two variants</span>
                  </label>
                  {abTestEnabled && (
                    <div className="mt-3 space-y-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                      <div className="flex items-center gap-2">
                        <SplitSquareHorizontal className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-medium text-purple-300">Variant B</span>
                      </div>
                      <input value={variantSubject} onChange={(e) => setVariantSubject(e.target.value)}
                        placeholder="Variant B subject line"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                      />
                      <textarea value={variantBody} onChange={(e) => setVariantBody(e.target.value)}
                        placeholder="<h1>Variant B HTML email here</h1>"
                        rows={6}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50 font-mono"
                      />
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Sample size per variant:</span>
                        <input type="number" min={5} max={50} value={samplePercent}
                          onChange={(e) => setSamplePercent(parseInt(e.target.value) || 20)}
                          className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-center"
                        />
                        <span>% of total leads each</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        After 24 hours, the variant with higher open rate automatically goes to the remaining leads.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              <button onClick={() => {
                if (composeStep === "leads") {
                  setComposeStep("compose");
                } else {
                  setShowCompose(false);
                }
              }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
              >{composeStep === "leads" ? "Back" : "Cancel"}</button>
              {composeStep === "compose" && (
                <>
                  <button onClick={openLeadSelector}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                  >
                    <Users className="w-4 h-4" />
                    Select Leads{selectedLeadIds.size > 0 ? ` (${selectedLeadIds.size})` : ""}
                  </button>
                  <button onClick={openLeadSelector} disabled={!name.trim() || !subject.trim() || !body.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    <Users className="w-4 h-4" /> Next: Select Leads
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

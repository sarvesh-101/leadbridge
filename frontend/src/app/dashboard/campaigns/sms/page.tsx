"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Send, Loader2, X, MessageSquare, Users, Search, CheckSquare, Square, BarChart3, Clock } from "lucide-react";

export default function SmsCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [composeStep, setComposeStep] = useState<"compose" | "leads">("compose");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const res = await api.get("/campaigns/sms/analytics");
      setCampaigns(res.campaigns || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function loadLeads(search = "", page = 1) {
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams(); params.set("page", String(page)); params.set("limit", "50");
      if (search) params.set("search", search);
      const data = await api.get(`/leads?${params.toString()}`);
      setLeads(data.leads || []); setLeadSearch(search);
    } catch { /* ignore */ }
    finally { setLeadsLoading(false); }
  }

  function toggleLead(id: string) {
    setSelectedLeadIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() {
    const ids = leads.map(l => l.id);
    setSelectedLeadIds(prev => ids.every(id => prev.has(id)) ? new Set([...prev].filter(id => !ids.includes(id))) : new Set([...prev, ...ids]));
  }

  async function handleSend() {
    if (!name.trim() || !message.trim()) return toast.error("Name and message required");
    if (selectedLeadIds.size === 0) return toast.error("Select leads");
    setActionLoading("send");
    try {
      const res = await api.post("/campaigns/sms/send", { name, message, targetLeadIds: Array.from(selectedLeadIds) });
      toast.success(`Sent! ${res.sent} delivered, ${res.failed} failed`);
      setShowCompose(false); setName(""); setMessage(""); setSelectedLeadIds(new Set()); setComposeStep("compose");
      await loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">SMS Campaigns</h1>
          <p className="text-gray-400 mt-1">Send bulk SMS messages to your leads</p>
        </div>
        <button onClick={() => { setShowCompose(true); setSelectedLeadIds(new Set()); setComposeStep("compose"); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> New SMS Campaign
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ icon: MessageSquare, label: "Total", value: loading ? "—" : campaigns.length, color: "text-blue-400" },
          { icon: Send, label: "Sent", value: loading ? "—" : campaigns.reduce((s: number, c: any) => s + (c.deliveredCount || 0), 0), color: "text-green-400" },
          { icon: BarChart3, label: "Failed", value: loading ? "—" : campaigns.reduce((s: number, c: any) => s + (c.failedCount || 0), 0), color: "text-red-400" },
          { icon: Clock, label: "Recipients", value: loading ? "—" : campaigns.reduce((s: number, c: any) => s + (c.totalRecipients || 0), 0), color: "text-emerald-400" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            {loading ? <div className="animate-pulse h-7 w-12 bg-white/10 rounded" /> : <><s.icon className={cn("w-5 h-5 mb-2", s.color)} /><div className="text-xl font-bold text-white">{s.value}</div><div className="text-xs text-gray-500">{s.label}</div></>}
          </div>
        ))}
      </div>

      {!loading && campaigns.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No SMS campaigns yet</h3>
          <p className="text-sm text-gray-500">Send your first bulk SMS campaign</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-green-400" /></div>
                <div><p className="text-sm text-white">{c.name}</p><p className="text-xs text-gray-500">{c.deliveredCount}/{c.totalRecipients} delivered</p></div>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-xs", c.status === "SENT" ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400")}>{c.status}</span>
            </div>
          ))}
        </div>
      )}

      {showCompose && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 0.95 }} className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">{composeStep === "leads" ? "Select Leads" : "Compose SMS Campaign"}</h2>
              <button onClick={() => setShowCompose(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            {composeStep === "leads" ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input value={leadSearch} onChange={e => loadLeads(e.target.value)} placeholder="Search leads..." className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500" />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <button onClick={selectAll} className="flex items-center gap-1.5 hover:text-white">{leads.every(l => selectedLeadIds.has(l.id)) ? <CheckSquare className="w-4 h-4 text-leadflow-accent" /> : <Square className="w-4 h-4" />} Select all</button>
                  <span>{selectedLeadIds.size} selected</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {leadsLoading ? [...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-white/5 border border-white/10 animate-pulse" />) :
                    leads.map(lead => (
                      <button key={lead.id} onClick={() => toggleLead(lead.id)} className={cn("w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all", selectedLeadIds.has(lead.id) ? "bg-leadflow-500/10 border border-leadflow-500/30" : "bg-white/5 border border-white/5 hover:bg-white/10")}>
                        {selectedLeadIds.has(lead.id) ? <CheckSquare className="w-4 h-4 text-leadflow-accent shrink-0" /> : <Square className="w-4 h-4 text-gray-500 shrink-0" />}
                        <div className="min-w-0"><div className="text-sm text-white truncate">{lead.name}</div><div className="text-xs text-gray-500 truncate">{lead.phone}</div></div>
                      </button>
                    ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setComposeStep("compose")} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5">Back</button>
                  <button onClick={handleSend} disabled={selectedLeadIds.size === 0 || actionLoading === "send"} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium disabled:opacity-50">
                    {actionLoading === "send" ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send to {selectedLeadIds.size}</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Campaign name" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500" />
                <div><label className="text-xs text-gray-400 mb-1 block">SMS Message</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Your SMS message here... Use {{leadName}} and {{businessName}} as placeholders" rows={6} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500" />
                  <p className="text-xs text-gray-500 mt-1">{message.length}/765 characters</p>
                </div>
                <p className="text-xs text-gray-500">Available variables: <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{leadName}}`}</code>, <code className="text-leadflow-accent bg-leadflow-500/10 px-1 rounded">{`{{businessName}}`}</code></p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCompose(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5">Cancel</button>
                  <button onClick={() => { setComposeStep("leads"); loadLeads(); }} disabled={!name.trim() || !message.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium disabled:opacity-50">
                    <Users className="w-4 h-4" /> Next: Select Leads
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

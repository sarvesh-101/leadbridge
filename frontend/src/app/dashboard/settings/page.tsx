"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  User, Bot, Link as LinkIcon, Bell, Shield, Save, Key, Smartphone,
  Phone, BookOpen, Plus, Trash2, Upload, Check, X, Globe, Loader2,
  ExternalLink, Radio, RadioTower,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────

interface OmnidimAgent {
  id: number;
  name: string;
  status?: string;
  welcome_message?: string;
  voice?: Record<string, unknown>;
  languages?: string[];
}

interface PhoneNumber {
  id: number;
  name?: string;
  phone_number: string;
  number_provider: string;
  active_bot_id?: number | null;
  active_bot_name?: string;
}

interface KnowledgeDoc {
  id: number;
  name: string;
  file_name?: string;
  file_size?: number;
  status?: string;
  attached_agent_id?: number | null;
}

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "voice-ai", label: "Voice AI", icon: Phone },
  { id: "integrations", label: "Integrations", icon: LinkIcon },
  { id: "security", label: "Security", icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState<string | null>(null);

  // Voice AI state
  const [agentId, setAgentId] = useState<number | null>(null);
  const [agents, setAgents] = useState<OmnidimAgent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");

  // Create agent form
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentLanguage, setNewAgentLanguage] = useState("hinglish");
  const [newAgentVoice, setNewAgentVoice] = useState("");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Load data
  const loadVoiceData = useCallback(async () => {
    try {
      const [agentRes, agentsRes, phonesRes, kbRes, webhookRes] = await Promise.all([
        api.get<{ agentId: number | null }>("/voice/agent-id"),
        api.get<{ agents: OmnidimAgent[] }>("/voice/agents"),
        api.get<{ numbers: PhoneNumber[] }>("/voice/phone-numbers"),
        api.get<{ documents: KnowledgeDoc[] }>("/voice/knowledge"),
        api.get<{ webhookUrl: string }>("/voice/webhook-url"),
      ]);
      setAgentId(agentRes.agentId);
      setAgents(agentsRes.agents);
      setPhoneNumbers(phonesRes.numbers);
      setKnowledgeDocs(kbRes.documents);
      setWebhookUrl(webhookRes.webhookUrl);
    } catch (err: any) {
      // Silently fail — Omnidimension may not be fully configured yet
    }
  }, []);

  useEffect(() => {
    if (activeTab === "voice-ai") loadVoiceData();
  }, [activeTab, loadVoiceData]);

  // ─── Agent Actions ────────────────────────────────────────────

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return toast.error("Agent name is required");
    setLoading("create-agent");
    try {
      const res = await api.post<{ agent: OmnidimAgent; isAssigned: boolean }>("/voice/agents", {
        name: newAgentName,
        language: newAgentLanguage,
        voiceId: newAgentVoice || undefined,
        systemPrompt: newAgentPrompt || undefined,
      });
      setAgents(prev => [res.agent, ...prev]);
      setAgentId(res.agent.id);
      setShowCreateAgent(false);
      setNewAgentName("");
      setNewAgentPrompt("");
      toast.success(`Agent "${res.agent.name}" created and assigned!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    } finally {
      setLoading(null);
    }
  };

  const handleSelectAgent = async (id: number) => {
    setLoading(`select-${id}`);
    try {
      await api.patch("/voice/agent-id", { agentId: id });
      setAgentId(id);
      toast.success("Agent assigned to your account");
    } catch (err: any) {
      toast.error(err.message || "Failed to assign agent");
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteAgent = async (id: number) => {
    setLoading(`delete-${id}`);
    try {
      await api.delete(`/voice/agents/${id}`);
      setAgents(prev => prev.filter(a => a.id !== id));
      if (agentId === id) setAgentId(null);
      toast.success("Agent deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete agent");
    } finally {
      setLoading(null);
    }
  };

  // ─── Phone Number Actions ─────────────────────────────────────

  const handleAttachPhone = async (phoneId: number, targetAgentId: number) => {
    setLoading(`phone-attach-${phoneId}`);
    try {
      await api.post("/voice/phone-numbers/attach", { phoneNumberId: phoneId, agentId: targetAgentId });
      setPhoneNumbers(prev => prev.map(p =>
        p.id === phoneId ? { ...p, active_bot_id: targetAgentId, active_bot_name: agents.find(a => a.id === targetAgentId)?.name } : p
      ));
      toast.success("Phone number attached");
    } catch (err: any) {
      toast.error(err.message || "Failed to attach phone number");
    } finally {
      setLoading(null);
    }
  };

  const handleDetachPhone = async (phoneId: number) => {
    setLoading(`phone-detach-${phoneId}`);
    try {
      await api.post("/voice/phone-numbers/detach", { phoneNumberId: phoneId });
      setPhoneNumbers(prev => prev.map(p =>
        p.id === phoneId ? { ...p, active_bot_id: null, active_bot_name: undefined } : p
      ));
      toast.success("Phone number detached");
    } catch (err: any) {
      toast.error(err.message || "Failed to detach phone number");
    } finally {
      setLoading(null);
    }
  };

  // ─── Knowledge Base Actions ───────────────────────────────────

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Only PDF files are supported");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<{ document: KnowledgeDoc }>("/voice/knowledge/upload", formData, {
        headers: { "Content-Type": undefined },
      } as any);
      setKnowledgeDocs(prev => [res.document, ...prev]);
      toast.success(`"${file.name}" uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAttachDoc = async (docId: number, targetAgentId: number) => {
    setLoading(`doc-attach-${docId}`);
    try {
      await api.post("/voice/knowledge/attach", { documentId: docId, agentId: targetAgentId });
      setKnowledgeDocs(prev => prev.map(d =>
        d.id === docId ? { ...d, attached_agent_id: targetAgentId } : d
      ));
      toast.success("Document attached to agent");
    } catch (err: any) {
      toast.error(err.message || "Failed to attach document");
    } finally {
      setLoading(null);
    }
  };

  const handleDetachDoc = async (docId: number) => {
    setLoading(`doc-detach-${docId}`);
    try {
      await api.post("/voice/knowledge/detach", { documentId: docId });
      setKnowledgeDocs(prev => prev.map(d =>
        d.id === docId ? { ...d, attached_agent_id: null } : d
      ));
      toast.success("Document detached");
    } catch (err: any) {
      toast.error(err.message || "Failed to detach document");
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    setLoading(`doc-del-${docId}`);
    try {
      await api.delete(`/voice/knowledge/${docId}`);
      setKnowledgeDocs(prev => prev.filter(d => d.id !== docId));
      toast.success("Document deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
    } finally {
      setLoading(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and platform configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-leadflow-500/20 text-leadflow-accent border border-leadflow-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Profile Tab ───────────────────────────────────────── */}
      {activeTab === "profile" && <ProfileTab />}

      {/* ─── Voice AI Tab ──────────────────────────────────────── */}
      {activeTab === "voice-ai" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

          {/* Webhook URL Info */}
          {webhookUrl && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <RadioTower className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-blue-300">Omnidimension Webhook URL</p>
                  <p className="text-xs text-blue-400/70 mt-1">Configure this in your Omnidimension Agent Dashboard → Post-Call Actions</p>
                  <code className="mt-2 block text-xs text-blue-200 bg-blue-500/10 px-3 py-2 rounded-lg break-all font-mono">
                    {webhookUrl}
                  </code>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs hover:bg-blue-500/30"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* ── Agents Section ──────────────────────────────────── */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-[#4F6EF7]" />
                <h2 className="text-lg font-semibold text-white">AI Agents</h2>
              </div>
              <button onClick={() => setShowCreateAgent(!showCreateAgent)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F6EF7]/10 text-[#4F6EF7] text-xs font-medium hover:bg-[#4F6EF7]/20"
              >
                <Plus className="w-3.5 h-3.5" /> {showCreateAgent ? "Cancel" : "New Agent"}
              </button>
            </div>

            {/* Create Agent Form */}
            <AnimatePresence>
              {showCreateAgent && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="p-4 rounded-xl bg-[#1A1A24] border border-[#2A2A3A] space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Agent Name *</label>
                      <input value={newAgentName} onChange={e => setNewAgentName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                        placeholder="e.g., Property Assistant" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Language</label>
                        <select value={newAgentLanguage} onChange={e => setNewAgentLanguage(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                        >
                          <option value="hinglish">Hinglish</option>
                          <option value="hi-IN">Hindi</option>
                          <option value="en-IN">English (India)</option>
                          <option value="en-US">English (US)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Voice ID (optional)</label>
                        <input value={newAgentVoice} onChange={e => setNewAgentVoice(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                          placeholder="Default ElevenLabs voice" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">System Prompt / Instructions</label>
                      <textarea value={newAgentPrompt} onChange={e => setNewAgentPrompt(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                        placeholder="Tell the agent how to behave, what to say, what questions to ask..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowCreateAgent(false)}
                        className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button onClick={handleCreateAgent} disabled={loading === "create-agent"}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4F6EF7] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {loading === "create-agent" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        Create Agent
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Agent List */}
            {agents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No AI agents yet. Create one to start making calls.
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((agent) => {
                  const isAssigned = agent.id === agentId;
                  const agentLoading = loading === `select-${agent.id}` || loading === `delete-${agent.id}`;
                  return (
                    <div key={agent.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all",
                        isAssigned
                          ? "bg-[#4F6EF7]/5 border-[#4F6EF7]/30"
                          : "bg-[#1A1A24] border-[#2A2A3A] hover:border-[#3A3A52]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          isAssigned ? "bg-[#4F6EF7]/20 text-[#4F6EF7]" : "bg-white/5 text-gray-400"
                        )}>
                          {isAssigned ? <Radio className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                            {isAssigned && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22D3A5]/10 text-[#22D3A5] font-medium">Active</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            ID: {agent.id} · {agent.languages?.join(", ") || "Hinglish"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isAssigned && (
                          <button onClick={() => handleSelectAgent(agent.id)} disabled={agentLoading}
                            className="px-3 py-1.5 rounded-lg bg-[#4F6EF7]/10 text-[#4F6EF7] text-xs hover:bg-[#4F6EF7]/20 disabled:opacity-50"
                          >
                            {agentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Assign"}
                          </button>
                        )}
                        <button onClick={() => handleDeleteAgent(agent.id)} disabled={agentLoading}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {loading === `delete-${agent.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Phone Numbers Section ──────────────────────────── */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <Smartphone className="w-5 h-5 text-[#22D3A5]" />
              <h2 className="text-lg font-semibold text-white">Phone Numbers</h2>
            </div>

            {phoneNumbers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No phone numbers found. Import one via the Omnidimension dashboard.
              </div>
            ) : (
              <div className="space-y-2">
                {phoneNumbers.map((pn) => {
                  const isAttached = pn.active_bot_id != null;
                  const pnLoading = loading === `phone-attach-${pn.id}` || loading === `phone-detach-${pn.id}`;
                  return (
                    <div key={pn.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isAttached ? "bg-[#22D3A5]/5 border-[#22D3A5]/20" : "bg-[#1A1A24] border-[#2A2A3A]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          isAttached ? "bg-[#22D3A5]/20 text-[#22D3A5]" : "bg-white/5 text-gray-400"
                        )}>
                          <Phone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">{pn.phone_number}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {pn.number_provider} · {pn.name || "Unnamed"}
                            {isAttached && pn.active_bot_name && ` → ${pn.active_bot_name}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAttached ? (
                          <button onClick={() => handleDetachPhone(pn.id)} disabled={pnLoading}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {pnLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Detach"}
                          </button>
                        ) : (
                          agentId && (
                            <button onClick={() => handleAttachPhone(pn.id, agentId)} disabled={pnLoading}
                              className="px-3 py-1.5 rounded-lg bg-[#22D3A5]/10 text-[#22D3A5] text-xs hover:bg-[#22D3A5]/20 disabled:opacity-50"
                            >
                              {pnLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Attach to Agent"}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Knowledge Base Section ─────────────────────────── */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-[#C9A84C]" />
                <h2 className="text-lg font-semibold text-white">Knowledge Base</h2>
              </div>
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-medium cursor-pointer hover:bg-[#C9A84C]/20">
                <Upload className="w-3.5 h-3.5" />
                Upload PDF
                <input type="file" accept=".pdf" onChange={handleUploadDoc} className="hidden" disabled={uploading} />
              </label>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A]">
                <Loader2 className="w-4 h-4 animate-spin text-[#C9A84C]" />
                <span className="text-sm text-gray-400">Uploading document...</span>
              </div>
            )}

            {knowledgeDocs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No documents uploaded. Upload property PDFs to help your AI agent answer questions.
              </div>
            ) : (
              <div className="space-y-2">
                {knowledgeDocs.map((doc) => {
                  const isAttached = doc.attached_agent_id != null;
                  const docLoading = loading === `doc-attach-${doc.id}` || loading === `doc-detach-${doc.id}` || loading === `doc-del-${doc.id}`;
                  return (
                    <div key={doc.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        isAttached ? "bg-[#C9A84C]/5 border-[#C9A84C]/20" : "bg-[#1A1A24] border-[#2A2A3A]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                          isAttached ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-white/5 text-gray-400"
                        )}>
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{doc.name || doc.file_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            ID: {doc.id}
                            {doc.file_size && ` · ${(doc.file_size / 1024).toFixed(0)} KB`}
                            {isAttached && ` · Attached to agent #${doc.attached_agent_id}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAttached ? (
                          <button onClick={() => handleDetachDoc(doc.id)} disabled={docLoading}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            {docLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Detach"}
                          </button>
                        ) : (
                          agentId && (
                            <button onClick={() => handleAttachDoc(doc.id, agentId)} disabled={docLoading}
                              className="px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C] text-xs hover:bg-[#C9A84C]/20 disabled:opacity-50"
                            >
                              {docLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Attach to Agent"}
                            </button>
                          )
                        )}
                        <button onClick={() => handleDeleteDoc(doc.id)} disabled={docLoading}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {loading === `doc-del-${doc.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Integrations Tab ──────────────────────────────────── */}
      {activeTab === "integrations" && <IntegrationsTab />}

      {/* ─── Security Tab ───────────────────────────────────────── */}
      {activeTab === "security" && <SecurityTab />}
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────

function ProfileTab() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-5">
      <h2 className="text-lg font-semibold text-white">Profile Information</h2>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-leadflow-500 to-leadflow-accent flex items-center justify-center text-xl font-bold text-white">JD</div>
        <div><button className="text-sm text-leadflow-accent hover:underline">Change photo</button></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { label: "First Name", value: "John", placeholder: "First name" },
          { label: "Last Name", value: "Doe", placeholder: "Last name" },
          { label: "Email", value: "john@example.com", placeholder: "Email" },
          { label: "Phone", value: "+91 98765 43210", placeholder: "Phone" },
        ].map((f) => (
          <div key={f.label}>
            <label className="block text-sm text-gray-400 mb-1.5">{f.label}</label>
            <input defaultValue={f.value} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50" />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Company</label>
        <input defaultValue="ABC Realty" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50" />
      </div>
      <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90">
        <Save className="w-4 h-4" /> Save Changes
      </button>
    </motion.div>
  );
}

// ─── Integrations Tab ───────────────────────────────────────────

function IntegrationsTab() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {[
        { name: "IndiaMart", status: "Connected", icon: "🏭", color: "text-green-400" },
        { name: "Justdial", status: "Disconnected", icon: "📞", color: "text-gray-400" },
        { name: "WhatsApp Cloud API", status: "Connected", icon: "💬", color: "text-green-400" },
        { name: "Omnidimension", status: "Active", icon: "🎙️", color: "text-blue-400", desc: "AI Voice Agent Platform" },
        { name: "Google Ads", status: "Available", icon: "🔍", color: "text-gray-400" },
        { name: "Facebook Leads", status: "Available", icon: "📘", color: "text-gray-400" },
      ].map((int) => (
        <div key={int.name} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{int.icon}</span>
            <div>
              <div className="text-sm font-medium text-white">{int.name}</div>
              <div className={cn("text-xs", int.color)}>{int.status}</div>
            </div>
          </div>
          <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">Configure</button>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Security Tab ───────────────────────────────────────────────

function SecurityTab() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-5">
      <h2 className="text-lg font-semibold text-white">Security Settings</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-gray-400" />
            <div><div className="text-sm text-white">API Key</div><div className="text-xs text-gray-500">Manage your API access keys</div></div>
          </div>
          <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">View Keys</button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-gray-400" />
            <div><div className="text-sm text-white">Two-Factor Auth</div><div className="text-xs text-gray-500">Add extra security to your account</div></div>
          </div>
          <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">Enable</button>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <div><div className="text-sm text-white">Webhook Notifications</div><div className="text-xs text-gray-500">Configure webhook endpoints for events</div></div>
          </div>
          <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">Configure</button>
        </div>
      </div>
    </motion.div>
  );
}

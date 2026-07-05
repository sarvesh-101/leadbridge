"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Bot, Phone, Smartphone, Radio, RadioTower, Check, X, Plus, Trash2,
  Loader2, ExternalLink, BookOpen, Upload, Play, Activity, BarChart3,
  Globe, ArrowRight, ChevronRight, Copy, RefreshCw, AlertCircle,
} from "lucide-react";
import Link from "next/link";

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

export default function VoiceAIPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [agentId, setAgentId] = useState<number | null>(null);
  const [agents, setAgents] = useState<OmnidimAgent[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [phoneSetupStatus, setPhoneSetupStatus] = useState("PENDING");

  // Create agent form
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentLanguage, setNewAgentLanguage] = useState("hinglish");
  const [newAgentVoice, setNewAgentVoice] = useState("");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");

  // Buy number modal
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyResult, setBuyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("india");

  // Test call
  const [testCallLoading, setTestCallLoading] = useState(false);
  const [testCallResult, setTestCallResult] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState(false);

  // Stats
  const [stats, setStats] = useState<{ totalCalls: number; todayCalls: number; avgDuration: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [meRes, agentRes, agentsRes, phonesRes, kbRes, webhookRes] = await Promise.all([
        api.get<any>("/me").catch(() => ({ client: {} })),
        api.get<{ agentId: number | null }>("/voice/agent-id"),
        api.get<{ agents: OmnidimAgent[] }>("/voice/agents").catch(() => ({ agents: [] })),
        api.get<{ numbers: PhoneNumber[] }>("/voice/phone-numbers").catch(() => ({ numbers: [] })),
        api.get<{ documents: KnowledgeDoc[] }>("/voice/knowledge").catch(() => ({ documents: [] })),
        api.get<{ webhookUrl: string }>("/voice/webhook-url").catch(() => ({ webhookUrl: "" })),
      ]);
      setAgentId(agentRes.agentId);
      setAgents(agentsRes.agents);
      setPhoneNumbers(phonesRes.numbers);
      setKnowledgeDocs(kbRes.documents);
      setWebhookUrl(webhookRes.webhookUrl);
      setPhoneSetupStatus(meRes.client?.phoneSetupStatus || "PENDING");
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success("Refreshed!");
  };

  // ─── Agent Actions ────────────────────────────────────────────

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return toast.error("Agent name is required");
    setCreatingAgent(true);
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
      setCreatingAgent(false);
    }
  };

  const handleSelectAgent = async (id: number) => {
    try {
      await api.patch("/voice/agent-id", { agentId: id });
      setAgentId(id);
      toast.success("Agent assigned");
    } catch (err: any) {
      toast.error(err.message || "Failed to assign agent");
    }
  };

  const handleDeleteAgent = async (id: number) => {
    try {
      await api.delete(`/voice/agents/${id}`);
      setAgents(prev => prev.filter(a => a.id !== id));
      if (agentId === id) setAgentId(null);
      toast.success("Agent deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete agent");
    }
  };

  // ─── Phone Actions ────────────────────────────────────────────

  const handleBuyNumber = async () => {
    setBuyLoading(true);
    setBuyResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>("/voice/phone-numbers/purchase", {
        region: selectedRegion,
      });
      setBuyResult(res);
      if (res.success) {
        setTimeout(() => { loadData(); setShowBuyModal(false); }, 1500);
      }
    } catch (err: any) {
      setBuyResult({ success: false, message: err.message || "Purchase failed" });
    } finally {
      setBuyLoading(false);
    }
  };

  const handleAttachPhone = async (phoneId: number, targetAgentId: number) => {
    try {
      await api.post("/voice/phone-numbers/attach", { phoneNumberId: phoneId, agentId: targetAgentId });
      setPhoneNumbers(prev => prev.map(p =>
        p.id === phoneId ? { ...p, active_bot_id: targetAgentId, active_bot_name: agents.find(a => a.id === targetAgentId)?.name } : p
      ));
      toast.success("Phone number attached");
    } catch (err: any) {
      toast.error(err.message || "Failed to attach phone number");
    }
  };

  const handleDetachPhone = async (phoneId: number) => {
    try {
      await api.post("/voice/phone-numbers/detach", { phoneNumberId: phoneId });
      setPhoneNumbers(prev => prev.map(p =>
        p.id === phoneId ? { ...p, active_bot_id: null, active_bot_name: undefined } : p
      ));
      toast.success("Phone number detached");
    } catch (err: any) {
      toast.error(err.message || "Failed to detach phone");
    }
  };

  // ─── Test Call ────────────────────────────────────────────────

  const handleTestCall = async () => {
    setTestCallLoading(true);
    setTestCallResult(null);
    try {
      const res = await api.post<{ message: string; status: string }>("/voice/test-call");
      setTestCallResult(res.status);
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err.message || "Test call failed");
      setTestCallResult("failed");
    } finally {
      setTestCallLoading(false);
    }
  };

  // ─── Knowledge Base ────────────────────────────────────────────

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Only PDF files are supported");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/voice/knowledge/upload", formData, { headers: { "Content-Type": undefined } } as any);
      toast.success(`"${file.name}" uploaded`);
      const kbRes = await api.get<{ documents: KnowledgeDoc[] }>("/voice/knowledge").catch(() => ({ documents: [] }));
      setKnowledgeDocs(kbRes.documents);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    try {
      await api.delete(`/voice/knowledge/${docId}`);
      setKnowledgeDocs(prev => prev.filter(d => d.id !== docId));
      toast.success("Document deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
    }
  };

  const hasAgent = agents.length > 0;
  const activeAgent = agents.find(a => a.id === agentId);
  const hasPhoneConnected = phoneNumbers.some(p => p.active_bot_id != null);
  const connectedPhone = phoneNumbers.find(p => p.active_bot_id != null);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Voice AI</h1>
          <p className="text-gray-400 mt-1">Manage your AI calling agent, phone numbers, and knowledge base</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs text-gray-400 hover:bg-white/5"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Status Banner */}
      <div className={cn(
        "p-4 rounded-xl border flex items-center gap-4",
        !hasAgent ? "bg-amber-500/10 border-amber-500/20" :
        !hasPhoneConnected ? "bg-blue-500/10 border-blue-500/20" :
        "bg-emerald-500/10 border-emerald-500/20"
      )}>
        {!hasAgent ? (
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
        ) : !hasPhoneConnected ? (
          <RadioTower className="w-5 h-5 text-blue-400 shrink-0" />
        ) : (
          <Radio className="w-5 h-5 text-emerald-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">
            {!hasAgent ? "No AI agent configured" :
             !hasPhoneConnected ? "No phone number connected" :
             "Your AI calling system is live"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {!hasAgent ? "Create an AI agent below to start handling calls automatically." :
             !hasPhoneConnected ? "Connect a phone number to enable outbound calling." :
             `Agent "${activeAgent?.name}" is ready — ${connectedPhone?.phone_number} connected`}
          </p>
        </div>
        {hasAgent && hasPhoneConnected && (
          <button onClick={handleTestCall} disabled={testCallLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 disabled:opacity-50 shrink-0"
          >
            {testCallLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Test Call
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ═══ Left Column: Agent Management ═══ */}
          <div className="xl:col-span-2 space-y-6">
            {/* ── AI Agents Section ── */}
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 text-[#4F6EF7]" />
                  <h2 className="text-base font-semibold text-white">AI Agents</h2>
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
                          <label className="block text-xs text-gray-400 mb-1">Voice ID</label>
                          <input value={newAgentVoice} onChange={e => setNewAgentVoice(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                            placeholder="Default ElevenLabs" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Instructions</label>
                        <textarea value={newAgentPrompt} onChange={e => setNewAgentPrompt(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                          placeholder="Tell the agent how to behave and what to ask..."
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreateAgent(false)}
                          className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-white/5"
                        >Cancel</button>
                        <button onClick={handleCreateAgent} disabled={creatingAgent || !newAgentName.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4F6EF7] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                        >
                          {creatingAgent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          Create Agent
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {agents.length === 0 ? (
                <div className="text-center py-10">
                  <Bot className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                  <p className="text-sm text-gray-400">No AI agents yet</p>
                  <p className="text-xs text-gray-600 mt-1">Create an agent to start handling calls automatically.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {agents.map((agent) => {
                    const isActive = agent.id === agentId;
                    return (
                      <div key={agent.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-all",
                          isActive ? "bg-[#4F6EF7]/5 border-[#4F6EF7]/30" : "bg-[#1A1A24] border-[#2A2A3A] hover:border-[#3A3A52]"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                            isActive ? "bg-[#4F6EF7]/20 text-[#4F6EF7]" : "bg-white/5 text-gray-400"
                          )}>
                            {isActive ? <Radio className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                              {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#22D3A5]/10 text-[#22D3A5] font-medium">Active</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              ID: {agent.id} · {agent.languages?.join(", ") || "Hinglish"} · {agent.status || "active"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <button onClick={() => handleSelectAgent(agent.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#4F6EF7]/10 text-[#4F6EF7] text-xs hover:bg-[#4F6EF7]/20"
                            >Assign</button>
                          )}
                          <button onClick={() => handleDeleteAgent(agent.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Phone Numbers Section ── */}
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-[#22D3A5]" />
                  <h2 className="text-base font-semibold text-white">Phone Numbers</h2>
                </div>
                <button onClick={() => setShowBuyModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22D3A5]/10 text-[#22D3A5] text-xs font-medium hover:bg-[#22D3A5]/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Buy Number
                </button>
              </div>

              {phoneNumbers.length === 0 ? (
                <div className="text-center py-10">
                  <Phone className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                  <p className="text-sm text-gray-400">No phone numbers</p>
                  <p className="text-xs text-gray-600 mt-1">Buy or import a number to enable outbound calling.</p>
                  <button onClick={() => setShowBuyModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#22D3A5]/10 text-[#22D3A5] text-xs font-medium hover:bg-[#22D3A5]/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Buy a Phone Number
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {phoneNumbers.map((pn) => {
                    const isAttached = pn.active_bot_id != null;
                    return (
                      <div key={pn.id}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border",
                          isAttached ? "bg-[#22D3A5]/5 border-[#22D3A5]/20" : "bg-[#1A1A24] border-[#2A2A3A]"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
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
                            <button onClick={() => handleDetachPhone(pn.id)}
                              className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs hover:bg-amber-500/20"
                            >Detach</button>
                          ) : (
                            agentId && (
                              <button onClick={() => handleAttachPhone(pn.id, agentId)}
                                className="px-3 py-1.5 rounded-lg bg-[#22D3A5]/10 text-[#22D3A5] text-xs hover:bg-[#22D3A5]/20"
                              >Attach to Agent</button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Knowledge Base Section ── */}
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-[#C9A84C]" />
                  <h2 className="text-base font-semibold text-white">Knowledge Base</h2>
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
                <div className="text-center py-8">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                  <p className="text-sm text-gray-400">No documents uploaded</p>
                  <p className="text-xs text-gray-600 mt-1">Upload property PDFs to help your AI answer questions.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {knowledgeDocs.map((doc) => (
                    <div key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4 text-[#C9A84C]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{doc.name || doc.file_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            ID: {doc.id}{doc.file_size && ` · ${(doc.file_size / 1024).toFixed(0)} KB`}
                            {doc.attached_agent_id && ` · Attached to agent #${doc.attached_agent_id}`}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteDoc(doc.id)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ Right Column: Status & Actions ═══ */}
          <div className="space-y-6">
            {/* Agent Status Card */}
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-5 h-5 text-[#4F6EF7]" />
                <h2 className="text-base font-semibold text-white">Status</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#1A1A24]">
                  <span className="text-xs text-gray-400">AI Agent</span>
                  <span className={cn("text-xs font-medium flex items-center gap-1.5",
                    hasAgent ? "text-[#22D3A5]" : "text-amber-400"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", hasAgent ? "bg-[#22D3A5]" : "bg-amber-400")} />
                    {hasAgent ? activeAgent?.name || "Ready" : "Not configured"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#1A1A24]">
                  <span className="text-xs text-gray-400">Phone Number</span>
                  <span className={cn("text-xs font-medium flex items-center gap-1.5",
                    hasPhoneConnected ? "text-[#22D3A5]" : "text-amber-400"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", hasPhoneConnected ? "bg-[#22D3A5]" : "bg-amber-400")} />
                    {hasPhoneConnected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#1A1A24]">
                  <span className="text-xs text-gray-400">Phone Setup</span>
                  <span className="text-xs font-medium text-white">{phoneSetupStatus.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#1A1A24]">
                  <span className="text-xs text-gray-400">Knowledge Docs</span>
                  <span className="text-xs font-medium text-white">{knowledgeDocs.length}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-5 h-5 text-[#4F6EF7]" />
                <h2 className="text-base font-semibold text-white">Quick Actions</h2>
              </div>
              <div className="space-y-2">
                {!hasAgent && (
                  <button onClick={() => setShowCreateAgent(true)}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] hover:border-[#4F6EF7]/30 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <Bot className="w-4 h-4 text-[#4F6EF7]" />
                      <span className="text-xs text-white">Create AI Agent</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#4F6EF7]" />
                  </button>
                )}
                <button onClick={() => setShowBuyModal(true)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] hover:border-[#22D3A5]/30 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#22D3A5]" />
                    <span className="text-xs text-white">Buy Phone Number</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-[#22D3A5]" />
                </button>
                <button onClick={handleTestCall} disabled={testCallLoading || !hasAgent}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] hover:border-emerald-500/30 text-left group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Play className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-white">Test Call</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-emerald-400" />
                </button>
                <Link href="/dashboard/settings"
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] hover:border-white/20 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-white">More Settings</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-white" />
                </Link>
              </div>

              {/* Test Call Result */}
              {testCallResult && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-400">✅ Test call initiated</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Your phone should ring within 30 seconds.</p>
                </div>
              )}
            </div>

            {/* Webhook URL */}
            {webhookUrl && (
              <div className="p-5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <RadioTower className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-blue-300">Webhook URL</p>
                    <p className="text-[11px] text-blue-400/70 mt-1">Configure in Omnidimension Agent Dashboard</p>
                    <code className="mt-2 block text-[11px] text-blue-200 bg-blue-500/10 px-2.5 py-2 rounded-lg break-all font-mono">
                      {webhookUrl}
                    </code>
                    <button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copied!"); }}
                      className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-[11px] hover:bg-blue-500/30"
                    >
                      <Copy className="w-3 h-3" /> Copy URL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Buy Number Modal ═══ */}
      <AnimatePresence>
        {showBuyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!buyLoading) setShowBuyModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-[#111118] border border-[#2A2A3A] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Buy Phone Number</h3>
                  <button onClick={() => setShowBuyModal(false)} className="text-gray-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Region</label>
                    <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50"
                    >
                      <option value="india">India</option>
                    </select>
                  </div>

                  {buyResult && (
                    <div className={cn(
                      "p-3 rounded-lg text-xs",
                      buyResult.success ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                      "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    )}>
                      {buyResult.message}
                    </div>
                  )}

                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Numbers are purchased through our telephony provider. After purchase, the number will appear in your list and you can attach it to your AI agent.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowBuyModal(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-gray-400 text-sm hover:bg-white/5"
                  >Cancel</button>
                  {!buyResult?.success ? (
                    <button onClick={handleBuyNumber} disabled={buyLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#22D3A5] text-black text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {buyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                      {buyLoading ? "Purchasing..." : "Buy Number"}
                    </button>
                  ) : (
                    <button onClick={() => { setShowBuyModal(false); setBuyResult(null); }}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20"
                    >Done</button>
                  )}
                </div>

                {/* Fallback to Omnidimension */}
                <div className="mt-4 pt-4 border-t border-[#2A2A3A]">
                  <p className="text-[11px] text-gray-500 mb-2">Can&apos;t buy here? Get one from the provider directly:</p>
                  <button onClick={() => window.open("https://app.omnidim.io", "_blank")}
                    className="flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-white/10"
                  >
                    Open Omnidimension Dashboard <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

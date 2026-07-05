"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Calendar, MessageSquare, FileText, Activity,
  MapPin, DollarSign, Clock, ThumbsUp, ThumbsDown, Meh,
  CheckCircle2, XCircle, Edit3, Loader2, BarChart3, BrainCircuit,
  RefreshCw, TrendingUp, Target, Zap, Gauge, AlertTriangle, Info, Home,
} from "lucide-react";
import { LeadStatusBadge } from "@/components/shared/LeadStatusBadge";

type Tab = "overview" | "scoring" | "calls" | "booking" | "messages" | "notes" | "properties";

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    async function loadLead() {
      setLoading(true);
      try {
        const data = await api.get(`/leads/${params.id}`);
        setLead(data);
      } catch (err: any) {
        toast.error("Failed to load lead");
        router.push("/dashboard/leads");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) loadLead();
  }, [params.id, router]);

  const fmt = (d: string | undefined | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return "—"; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#4F6EF7] animate-spin" />
      </div>
    );
  }

  if (!lead) return null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <FileText className="w-4 h-4" /> },
    { id: "scoring", label: "Scoring", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "calls", label: "Calls", icon: <Phone className="w-4 h-4" /> },
    { id: "booking", label: "Booking", icon: <Calendar className="w-4 h-4" /> },
    { id: "messages", label: "Messages", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "properties", label: "Properties", icon: <Home className="w-4 h-4" /> },
    { id: "notes", label: "Notes", icon: <Edit3 className="w-4 h-4" /> },
  ];

  const qualFields = [
    { label: "Budget", value: lead.budget || "—", icon: <DollarSign className="w-4 h-4" /> },
    { label: "Location", value: lead.location || "—", icon: <MapPin className="w-4 h-4" /> },
    { label: "Timeline", value: lead.timeline || "—", icon: <Clock className="w-4 h-4" /> },
    { label: "Property", value: lead.propertyType ? `${lead.bedrooms || ""} ${lead.propertyType}`.trim() : "—", icon: <Activity className="w-4 h-4" /> },
    { label: "Sentiment", value: lead.sentiment || "—", icon: lead.sentiment === "positive" ? <ThumbsUp className="w-4 h-4 text-[#22D3A5]" /> : lead.sentiment === "negative" ? <ThumbsDown className="w-4 h-4 text-[#F43F5E]" /> : <Meh className="w-4 h-4 text-[#F59E0B]" /> },
    { label: "Language", value: lead.callLanguage || "—", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const timeline = [
    { event: "Lead received", date: lead.receivedAt, icon: <Activity className="w-3.5 h-3.5" /> },
    ...(lead.firstCalledAt ? [{ event: "First call attempted", date: lead.firstCalledAt, icon: <Phone className="w-3.5 h-3.5" /> }] : []),
    ...(lead.bookedAt ? [{ event: "Visit booked", date: lead.bookedAt, icon: <Calendar className="w-3.5 h-3.5" /> }] : []),
    ...(lead.visitedAt ? [{ event: "Customer visited", date: lead.visitedAt, icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#22D3A5]" /> }] : []),
    ...(lead.convertedAt ? [{ event: "Deal closed", date: lead.convertedAt, icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#22D3A5]" /> }] : []),
    ...(lead.coldAt ? [{ event: "Lead marked cold", date: lead.coldAt, icon: <XCircle className="w-3.5 h-3.5 text-[#F43F5E]" /> }] : []),
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-[#1A1A24] text-[#6B6B8A]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{lead.name}</h1>
            <LeadStatusBadge status={lead.status} pulse={lead.status === "CALLING"} />
          </div>
          <p className="text-sm text-[#6B6B8A] font-mono mt-1">{lead.phone} · {lead.source} · {lead.email || "No email"}</p>
        </div>
      </div>

      {/* Score bar with manual override */}
      {lead.score > 0 && (
        <ScoreEditor leadId={lead.id} initialScore={lead.score} onScoreUpdated={(s) => setLead({ ...lead, score: s })} />
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#2A2A3A] gap-0">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id ? "border-[#4F6EF7] text-[#4F6EF7]" : "border-transparent text-[#6B6B8A] hover:text-white"
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {qualFields.map((field) => (
              <div key={field.label} className="flex items-start gap-3 p-4 rounded-xl bg-[#111118] border border-[#2A2A3A]">
                <div className="mt-0.5 text-[#6B6B8A]">{field.icon}</div>
                <div>
                  <p className="text-xs text-[#6B6B8A]">{field.label}</p>
                  <p className="text-sm font-medium text-white">{field.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-xl bg-[#111118] border-l-4 border-[#4F6EF7]">
            <p className="text-sm italic text-[#6B6B8A]">
              {lead.score >= 70 ? "High-intent buyer — ready to close. Recommended: priority call and site visit scheduling." :
               lead.score >= 40 ? "Moderate interest — needs follow-up. Budget and timeline confirmed, proceed with visit booking." :
               "Low engagement — requires re-engagement sequence. Consider sending WhatsApp follow-up."}
            </p>
          </div>

          <div className="space-y-0">
            <h3 className="text-sm font-medium text-white mb-4">Timeline</h3>
            {timeline.map((item, i) => (
              <div key={i} className="flex items-start gap-3 pb-4 relative">
                {i < timeline.length - 1 && (
                  <div className="absolute left-[11px] top-5 bottom-0 w-px bg-[#2A2A3A]" />
                )}
                <div className="mt-0.5 text-[#6B6B8A] bg-[#1A1A24] rounded-full p-1">{item.icon}</div>
                <div>
                  <p className="text-sm text-white">{item.event}</p>
                  <p className="text-xs text-[#6B6B8A]">{fmt(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "scoring" && <ScoreBreakdown leadId={lead.id} initialScore={lead.score} onScoreUpdated={(s) => setLead({ ...lead, score: s })} />}

      {activeTab === "calls" && (
        <div className="space-y-3">
          {(lead.calls || []).length === 0 ? (
            <div className="text-center py-12 text-[#6B6B8A]">
              <Phone className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No calls yet</p>
            </div>
          ) : (
            (lead.calls || []).map((call: any) => (
              <div key={call.id} className="p-5 rounded-xl bg-[#111118] border border-[#2A2A3A]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#6B6B8A] font-medium">{call.type}</span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded",
                    call.status === "COMPLETED" ? "bg-[#22D3A5]/10 text-[#22D3A5]" :
                    call.status === "NO_ANSWER" || call.status === "FAILED" ? "bg-[#F43F5E]/10 text-[#F43F5E]" :
                    "bg-[#4F6EF7]/10 text-[#4F6EF7]"
                  )}>{call.status}</span>
                </div>
                <p className="text-xs text-[#6B6B8A]">{fmt(call.createdAt)}</p>
                {call.duration && <p className="text-xs text-[#6B6B8A] mt-1">{call.duration}s duration</p>}
                {call.summary && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-[#4F6EF7] cursor-pointer">View summary</summary>
                    <p className="text-sm text-[#6B6B8A] mt-2 whitespace-pre-wrap">{call.summary}</p>
                  </details>
                )}
                {call.transcript && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-[#4F6EF7] cursor-pointer">Full transcript</summary>
                    <p className="text-xs text-[#6B6B8A] mt-2 whitespace-pre-wrap font-mono">{call.transcript}</p>
                  </details>
                )}
                {call.recordingUrl && (
                  <audio controls className="mt-3 w-full h-8">
                    <source src={call.recordingUrl} type="audio/mpeg" />
                  </audio>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "properties" && <PropertySuggestions leadId={lead.id} />}

      {activeTab === "booking" && (
        <div>
          {!lead.booking ? (
            <div className="text-center py-12 text-[#6B6B8A]">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No visit booked yet</p>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#22D3A5]/10 border border-[#22D3A5]/30">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-[#22D3A5]" />
                <h3 className="text-lg font-semibold text-white">Visit Scheduled</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-white">
                    {lead.booking.visitDate ? new Date(lead.booking.visitDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "—"}
                  </p>
                  <p className="text-base text-[#22D3A5] font-medium">{lead.booking.visitTime}</p>
                </div>
                {lead.booking.propertyAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#6B6B8A] mt-0.5" />
                    <p className="text-sm text-[#6B6B8A]">{lead.booking.propertyAddress}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-4">
                  <span className={cn("px-3 py-1 rounded-full text-xs font-medium",
                    lead.booking.status === "CONFIRMED" ? "bg-[#22D3A5]/10 text-[#22D3A5]" :
                    lead.booking.status === "VISITED" ? "bg-[#22D3A5] text-black" :
                    lead.booking.status === "NO_SHOW" ? "bg-[#F43F5E]/10 text-[#F43F5E]" :
                    "bg-[#6B6B8A]/10 text-[#6B6B8A]"
                  )}>
                    {lead.booking.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "messages" && (
        <div className="space-y-3">
          {(lead.customerNotifications || []).length === 0 && (lead.ownerNotifications || []).length === 0 ? (
            <div className="text-center py-12 text-[#6B6B8A]">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No messages sent yet</p>
            </div>
          ) : (
            [...(lead.customerNotifications || []), ...(lead.ownerNotifications || [])].sort((a: any, b: any) =>
              new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
            ).map((n: any) => (
              <div key={n.id} className="p-4 rounded-xl bg-[#111118] border border-[#2A2A3A]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#6B6B8A]">{n.type} · {n.channel || "whatsapp"}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded",
                    n.status === "sent" || n.status === "delivered" ? "bg-[#22D3A5]/10 text-[#22D3A5]" : "bg-[#F43F5E]/10 text-[#F43F5E]"
                  )}>{n.status}</span>
                </div>
                <p className="text-sm text-white line-clamp-2">{n.message}</p>
                <p className="text-xs text-[#6B6B8A] mt-1">{fmt(n.sentAt)}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "notes" && <NotesTab leadId={lead.id} />}
    </div>
  );
}

/* ─── Score Editor Component ───────────────────────────────────── */
function ScoreEditor({ leadId, initialScore, onScoreUpdated }: { leadId: string; initialScore: number; onScoreUpdated: (score: number) => void }) {
  const [score, setScore] = useState(initialScore);
  const [editing, setEditing] = useState(false);
  const [tempScore, setTempScore] = useState(initialScore);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  async function loadHistory() {
    try {
      const res = await api.get(`/leads/${leadId}/score-history`);
      setHistory(res.history || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load score history");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/leads/${leadId}/score`, { score: tempScore, reason: "Manual override" });
      setScore(tempScore);
      setEditing(false);
      onScoreUpdated(tempScore);
      toast.success("Score updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update score");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 rounded-xl bg-[#111118] border border-[#2A2A3A]">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#6B6B8A]">Conversion Score</span>
        <div className="flex-1 h-2 rounded-full bg-[#1A1A24] overflow-hidden">
          <div className={cn(
            "h-full rounded-full transition-all duration-500",
            score >= 70 ? "bg-[#22D3A5]" : score >= 40 ? "bg-[#F59E0B]" : "bg-[#6B6B8A]"
          )} style={{ width: `${score}%` }} />
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} value={tempScore}
              onChange={(e) => setTempScore(parseInt(e.target.value))}
              className="w-24 h-1.5"
            />
            <span className="text-sm font-mono text-white w-8 text-right">{tempScore}</span>
            <button onClick={handleSave} disabled={saving}
              className="px-2 py-1 rounded text-xs bg-[#4F6EF7] text-white font-medium hover:brightness-110"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setTempScore(score); }}
              className="px-2 py-1 rounded text-xs text-[#6B6B8A] hover:text-white"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-white">{score}</span>
            <button onClick={() => { setEditing(true); loadHistory(); }}
              className="p-1.5 rounded-lg hover:bg-[#1A1A24] text-[#6B6B8A]"
              title="Edit score"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
              className="p-1.5 rounded-lg hover:bg-[#1A1A24] text-[#6B6B8A]"
              title="Score history"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Score history */}
      {showHistory && history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#2A2A3A] space-y-1.5">
          <p className="text-[11px] text-[#6B6B8A] font-medium">Score History</p>
          {history.map((h: any, i: number) => (
            <div key={h.id || i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  h.score >= 70 ? "bg-[#22D3A5]" : h.score >= 40 ? "bg-[#F59E0B]" : "bg-[#6B6B8A]"
                )} />
                <span className="text-white font-mono">{h.score}</span>
                <span className="text-[#6B6B8A]">{h.source === "manual" ? "✏️ Manual" : "🤖 Auto"}</span>
                {h.reason && <span className="text-[#6B6B8A] truncate max-w-[100px]">— {h.reason}</span>}
              </div>
              <span className="text-[#6B6B8A]">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}</span>
            </div>
          ))}
        </div>
      )}
      {showHistory && history.length === 0 && (
        <div className="mt-3 pt-3 border-t border-[#2A2A3A] text-xs text-[#6B6B8A] text-center">
          No score history yet
        </div>
      )}
    </div>
  );
}

/* ─── Score Breakdown Component ────────────────────────────────── */
function ScoreBreakdown({ leadId, initialScore, onScoreUpdated }: { leadId: string; initialScore: number; onScoreUpdated: (score: number) => void }) {
  const [breakdown, setBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rescoreLoading, setRescoreLoading] = useState(false);

  useEffect(() => {
    loadBreakdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function loadBreakdown() {
    setLoading(true);
    try {
      const data = await api.get(`/leads/${leadId}/score-breakdown`);
      setBreakdown(data);
      if (data.score !== initialScore) {
        onScoreUpdated(data.score);
      }
    } catch (err: any) {
      toast.error("Failed to load score breakdown");
    } finally {
      setLoading(false);
    }
  }

  async function handleRescore() {
    setRescoreLoading(true);
    try {
      const data = await api.post(`/leads/${leadId}/re-score`);
      toast.success(`Score recalculated: ${data.score}`);
      await loadBreakdown();
    } catch (err: any) {
      toast.error(err.message || "Failed to re-score");
    } finally {
      setRescoreLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-[#4F6EF7] animate-spin" />
      </div>
    );
  }

  if (!breakdown) {
    return <div className="text-center py-12 text-[#6B6B8A]">Could not load score breakdown</div>;
  }

  const factorColors: Record<string, string> = {
    source: "#22D3A5",
    latency: "#4F6EF7",
    timeline: "#F59E0B",
    budget: "#8B5CF6",
    propertyType: "#EC4899",
    callHour: "#06B6D4",
    territory: "#F97316",
    sentiment: "#EF4444",
  };

  const factorIcons: Record<string, React.ReactNode> = {
    source: <Target className="w-4 h-4" />,
    latency: <Zap className="w-4 h-4" />,
    timeline: <Clock className="w-4 h-4" />,
    budget: <DollarSign className="w-4 h-4" />,
    propertyType: <Activity className="w-4 h-4" />,
    callHour: <Gauge className="w-4 h-4" />,
    territory: <MapPin className="w-4 h-4" />,
    sentiment: <ThumbsUp className="w-4 h-4" />,
  };

  // Sort factors by absolute contribution (descending)
  const sortedFactors = Object.entries(breakdown.factors as Record<string, number>)
    .filter(([k]) => k !== "error" && breakdown.factorLabels?.[k])
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

  return (
    <div className="space-y-5">
      {/* Score Gauge */}
      <div className="flex items-center gap-6 p-5 rounded-xl bg-[#111118] border border-[#2A2A3A]">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="#1A1A24" strokeWidth="6" />
            <circle cx="36" cy="36" r="30" fill="none"
              stroke={breakdown.score >= 70 ? "#22D3A5" : breakdown.score >= 40 ? "#F59E0B" : "#6B6B8A"}
              strokeWidth="6" strokeDasharray={`${(breakdown.score / 100) * 188.5} 188.5`}
              strokeLinecap="round" className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold font-mono text-white">{breakdown.score}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="w-4 h-4 text-[#4F6EF7]" />
            <h3 className="text-sm font-semibold text-white">AI Score Analysis</h3>
          </div>
          <p className="text-[13px] text-[#6B6B8A] leading-relaxed">
            {breakdown.explanation}
          </p>
          <button onClick={handleRescore} disabled={rescoreLoading}
            className="mt-2 flex items-center gap-1.5 text-[12px] text-[#4F6EF7] hover:text-[#4F6EF7]/80 font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rescoreLoading ? "animate-spin" : ""}`} />
            {rescoreLoading ? "Recalculating..." : "Re-score this lead"}
          </button>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="p-5 rounded-xl bg-[#111118] border border-[#2A2A3A]">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#4F6EF7]" />
          Factor Breakdown
          <span className="text-[11px] text-[#6B6B8A] font-normal ml-1">— weighted contribution to score</span>
        </h3>
        <div className="space-y-3">
          {sortedFactors.map(([key, value]) => {
            const label = breakdown.factorLabels[key];
            const color = factorColors[key] || "#6B6B8A";
            const isPositive = value >= 0;
            const absValue = Math.abs(value);
            const maxPossible = key === "sentiment" ? 25 : 20;
            const barPercent = Math.min((absValue / maxPossible) * 100, 100);

            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1A1A24] flex items-center justify-center shrink-0" style={{ color }}>
                  {factorIcons[key] || <Info className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-[#F0F0F8]">{label?.label || key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#6B6B8A]">{label?.weight || ""}</span>
                      <span className={cn(
                        "text-[13px] font-mono font-semibold",
                        isPositive ? "text-[#22D3A5]" : "text-[#F43F5E]"
                      )}>
                        {isPositive ? "+" : ""}{absValue.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1A1A24] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barPercent}%`, backgroundColor: isPositive ? color : "#F43F5E" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score History Trend */}
      {breakdown.history?.length > 1 && (
        <div className="p-5 rounded-xl bg-[#111118] border border-[#2A2A3A]">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#22D3A5]" />
            Score Trend
          </h3>
          <div className="flex items-end gap-2 h-24">
            {[...breakdown.history].reverse().map((h: any, i: number) => {
              const heightPct = Math.max(h.score, 5);
              const isLatest = i === breakdown.history.length - 1;
              return (
                <div key={h.id || i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-md transition-all duration-500 relative group"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: h.score >= 70 ? "#22D3A5" : h.score >= 40 ? "#F59E0B" : "#6B6B8A",
                      opacity: isLatest ? 1 : 0.6,
                    }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1A1A24] text-[11px] text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                      {h.score} — {h.source === "manual" ? "Manual" : "Auto"}
                    </div>
                  </div>
                  <span className="text-[9px] text-[#6B6B8A]">
                    {new Date(h.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* When no history yet */}
      {(!breakdown.history || breakdown.history.length <= 1) && (
        <div className="p-5 rounded-xl bg-[#111118] border border-[#2A2A3A]">
          <div className="flex items-center gap-2 text-[#6B6B8A]">
            <Info className="w-4 h-4" />
            <p className="text-[13px]">Score history will appear here after scoring events occur.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Property Suggestions Component ──────────────────────────── */
function PropertySuggestions({ leadId }: { leadId: string }) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/properties/suggestions/${leadId}`);
        setSuggestions(res.suggestions || []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  if (loading) {
    return <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#4F6EF7] mx-auto" /></div>;
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <Home className="w-10 h-10 text-[#3A3A52] mx-auto mb-3" />
        <p className="text-sm text-[#6B6B8A]">No matching properties found</p>
        <p className="text-xs text-[#3A3A52] mt-1">Add more properties or wait for lead qualification data</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#6B6B8A]">{suggestions.length} matching properties</p>
        <span className="text-[11px] text-[#4F6EF7]">Match Score →</span>
      </div>
      {suggestions.map((prop: any) => (
        <div key={prop.propertyId}
          className="p-4 rounded-xl bg-[#111118] border border-[#2A2A3A] border-l-4"
          style={{
            borderLeftColor: prop.score >= 70 ? "#22D3A5" : prop.score >= 40 ? "#F59E0B" : "#6B6B8A",
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="text-sm font-semibold text-white">{prop.propertyName}</h4>
              <p className="text-xs text-[#6B6B8A]">{prop.propertyLocation || "—"}</p>
            </div>
            <div className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold font-mono",
              prop.score >= 70 ? "bg-[#22D3A5]/20 text-[#22D3A5]" :
              prop.score >= 40 ? "bg-[#F59E0B]/20 text-[#F59E0B]" :
              "bg-[#6B6B8A]/20 text-[#6B6B8A]"
            )}>
              {prop.score}%
            </div>
          </div>
          {prop.propertyPrice && (
            <p className="text-sm text-[#F0F0F8] font-mono mb-2">
              ₹{(prop.propertyPrice / 100000).toFixed(1)}L
            </p>
          )}
          {prop.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prop.matchReasons.slice(0, 3).map((reason: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A24] text-[#6B6B8A] border border-[#2A2A3A]">
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NotesTab({ leadId }: { leadId: string }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/leads/${leadId}/notes`, { notes: note });
      toast.success("Note saved");
      setNote("");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note about this lead..."
        rows={6}
        className="w-full px-4 py-3 rounded-xl bg-[#111118] border border-[#2A2A3A] text-sm text-white placeholder-[#3A3A52] focus:outline-none focus:border-[#4F6EF7] resize-none"
      />
      <button onClick={handleSave} disabled={!note.trim() || saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#4F6EF7]/80 text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-all"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Note"}
      </button>
    </div>
  );
}

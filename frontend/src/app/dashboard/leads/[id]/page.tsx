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
import { CustomerActivityPanel } from "@/components/leads/CustomerActivityPanel";

type Tab = "overview" | "scoring" | "calls" | "booking" | "messages" | "notes" | "properties" | "activity";

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
        <Loader2 className="w-6 h-6 text-[#6FE3B0] animate-spin" />
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
    { id: "activity", label: "Activity", icon: <Activity className="w-4 h-4" /> },
    { id: "notes", label: "Notes", icon: <Edit3 className="w-4 h-4" /> },
  ];

  const qualFields = [
    { label: "Budget", value: lead.budget || "—", icon: <DollarSign className="w-4 h-4" /> },
    { label: "Location", value: lead.location || "—", icon: <MapPin className="w-4 h-4" /> },
    { label: "Timeline", value: lead.timeline || "—", icon: <Clock className="w-4 h-4" /> },
    { label: "Property", value: lead.propertyType ? `${lead.bedrooms || ""} ${lead.propertyType}`.trim() : "—", icon: <Activity className="w-4 h-4" /> },
    { label: "Sentiment", value: lead.sentiment || "—", icon: lead.sentiment === "positive" ? <ThumbsUp className="w-4 h-4 text-[#34D399]" /> : lead.sentiment === "negative" ? <ThumbsDown className="w-4 h-4 text-[#FB7185]" /> : <Meh className="w-4 h-4 text-[#E8C468]" /> },
    { label: "Language", value: lead.callLanguage || "—", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  const timeline = [
    { event: "Lead received", date: lead.receivedAt, icon: <Activity className="w-3.5 h-3.5" /> },
    ...(lead.firstCalledAt ? [{ event: "First call attempted", date: lead.firstCalledAt, icon: <Phone className="w-3.5 h-3.5" /> }] : []),
    ...(lead.bookedAt ? [{ event: "Visit booked", date: lead.bookedAt, icon: <Calendar className="w-3.5 h-3.5" /> }] : []),
    ...(lead.visitedAt ? [{ event: "Customer visited", date: lead.visitedAt, icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" /> }] : []),
    ...(lead.convertedAt ? [{ event: "Deal closed", date: lead.convertedAt, icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" /> }] : []),
    ...(lead.coldAt ? [{ event: "Lead marked cold", date: lead.coldAt, icon: <XCircle className="w-3.5 h-3.5 text-[#FB7185]" /> }] : []),
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#F0F7F3]">{lead.name}</h1>
            <LeadStatusBadge status={lead.status} pulse={lead.status === "CALLING"} />
          </div>
          <p className="text-sm text-[#9FB0A6] font-mono mt-1">{lead.phone} · {lead.source} · {lead.email || "No email"}</p>
        </div>
      </div>

      {/* Score bar with manual override */}
      {lead.score > 0 && (
        <ScoreEditor leadId={lead.id} initialScore={lead.score} onScoreUpdated={(s) => setLead({ ...lead, score: s })} />
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-0">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id ? "border-[#34D399]/50 text-[#6FE3B0]" : "border-transparent text-[#9FB0A6] hover:text-[#F0F7F3]"
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
              <div key={field.label} className="flex items-start gap-3 p-4 rounded-xl app-card">
                <div className="mt-0.5 text-[#9FB0A6]">{field.icon}</div>
                <div>
                  <p className="text-xs text-[#9FB0A6]">{field.label}</p>
                  <p className="text-sm font-medium text-[#F0F7F3]">{field.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-xl bg-[#101713] border-l-4 border-[#34D399]/50">
            <p className="text-sm italic text-[#9FB0A6]">
              {lead.score >= 70 ? "High-intent buyer — ready to close. Recommended: priority call and site visit scheduling." :
               lead.score >= 40 ? "Moderate interest — needs follow-up. Budget and timeline confirmed, proceed with visit booking." :
               "Low engagement — requires re-engagement sequence. Consider sending WhatsApp follow-up."}
            </p>
          </div>

          <div className="space-y-0">
            <h3 className="text-sm font-medium text-[#F0F7F3] mb-4">Timeline</h3>
            {timeline.map((item, i) => (
              <div key={i} className="flex items-start gap-3 pb-4 relative">
                {i < timeline.length - 1 && (
                  <div className="absolute left-[11px] top-5 bottom-0 w-px bg-white/10" />
                )}
                <div className="mt-0.5 text-[#9FB0A6] bg-white/[0.06] rounded-full p-1">{item.icon}</div>
                <div>
                  <p className="text-sm text-[#F0F7F3]">{item.event}</p>
                  <p className="text-xs text-[#9FB0A6]">{fmt(item.date)}</p>
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
            <div className="text-center py-12 text-[#9FB0A6]">
              <Phone className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No calls yet</p>
            </div>
          ) : (
            (lead.calls || []).map((call: any) => (
              <div key={call.id} className="p-5 rounded-xl app-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#9FB0A6] font-medium">{call.type}</span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded",
                    call.status === "COMPLETED" ? "bg-[#34D399]/15 text-[#34D399]" :
                    call.status === "NO_ANSWER" || call.status === "FAILED" ? "bg-[#FB7185]/15 text-[#FB7185]" :
                    "bg-[#34D399]/15 text-[#6FE3B0]"
                  )}>{call.status}</span>
                </div>
                <p className="text-xs text-[#9FB0A6]">{fmt(call.createdAt)}</p>
                {call.duration && <p className="text-xs text-[#9FB0A6] mt-1">{call.duration}s duration</p>}
                {call.summary && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-[#6FE3B0] cursor-pointer">View summary</summary>
                    <p className="text-sm text-[#9FB0A6] mt-2 whitespace-pre-wrap">{call.summary}</p>
                  </details>
                )}
                {call.transcript && (
                  <details className="mt-2">
                    <summary className="text-xs font-medium text-[#6FE3B0] cursor-pointer">Full transcript</summary>
                    <p className="text-xs text-[#9FB0A6] mt-2 whitespace-pre-wrap font-mono">{call.transcript}</p>
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
            <div className="text-center py-12 text-[#9FB0A6]">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No visit booked yet</p>
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[#34D399]/15 border border-[#34D399]/40">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-[#34D399]" />
                <h3 className="text-lg font-semibold text-[#F0F7F3]">Visit Scheduled</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-[#F0F7F3]">
                    {lead.booking.visitDate ? new Date(lead.booking.visitDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "—"}
                  </p>
                  <p className="text-base text-[#34D399] font-medium">{lead.booking.visitTime}</p>
                </div>
                {lead.booking.propertyAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-[#9FB0A6] mt-0.5" />
                    <p className="text-sm text-[#9FB0A6]">{lead.booking.propertyAddress}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-4">
                  <span className={cn("px-3 py-1 rounded-full text-xs font-medium",
                    lead.booking.status === "CONFIRMED" ? "bg-[#34D399]/15 text-[#34D399]" :
                    lead.booking.status === "VISITED" ? "bg-[#34D399] text-black" :
                    lead.booking.status === "NO_SHOW" ? "bg-[#FB7185]/15 text-[#FB7185]" :
                    "bg-[#5C6B62]/10 text-[#9FB0A6]"
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
            <div className="text-center py-12 text-[#9FB0A6]">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No messages sent yet</p>
            </div>
          ) : (
            [...(lead.customerNotifications || []), ...(lead.ownerNotifications || [])].sort((a: any, b: any) =>
              new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
            ).map((n: any) => (
              <div key={n.id} className="p-4 rounded-xl app-card">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#9FB0A6]">{n.type} · {n.channel || "whatsapp"}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded",
                    n.status === "sent" || n.status === "delivered" ? "bg-[#34D399]/15 text-[#34D399]" : "bg-[#FB7185]/15 text-[#FB7185]"
                  )}>{n.status}</span>
                </div>
                <p className="text-sm text-[#F0F7F3] line-clamp-2">{n.message}</p>
                <p className="text-xs text-[#9FB0A6] mt-1">{fmt(n.sentAt)}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "activity" && <CustomerActivityPanel leadId={lead.id} />}
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
    <div className="p-4 rounded-xl app-card">
      <div className="flex items-center gap-3">
        <span className="text-sm text-[#9FB0A6]">Conversion Score</span>
        <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={cn(
            "h-full rounded-full transition-all duration-500",
            score >= 70 ? "bg-[#34D399]" : score >= 40 ? "bg-[#B45309]" : "bg-[#5C6B62]"
          )} style={{ width: `${score}%` }} />
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} value={tempScore}
              onChange={(e) => setTempScore(parseInt(e.target.value))}
              className="w-24 h-1.5"
            />
            <span className="text-sm font-mono text-[#F0F7F3] w-8 text-right">{tempScore}</span>
            <button onClick={handleSave} disabled={saving}
              className="px-2 py-1 rounded text-xs bg-[#1B4332] text-white font-medium hover:brightness-110"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setTempScore(score); }}
              className="px-2 py-1 rounded text-xs text-[#9FB0A6] hover:text-[#F0F7F3]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-[#F0F7F3]">{score}</span>
            <button onClick={() => { setEditing(true); loadHistory(); }}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]"
              title="Edit score"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]"
              title="Score history"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Score history */}
      {showHistory && history.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
          <p className="text-[11px] text-[#9FB0A6] font-medium">Score History</p>
          {history.map((h: any, i: number) => (
            <div key={h.id || i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  h.score >= 70 ? "bg-[#34D399]" : h.score >= 40 ? "bg-[#B45309]" : "bg-[#5C6B62]"
                )} />
                <span className="text-[#F0F7F3] font-mono">{h.score}</span>
                <span className="text-[#9FB0A6]">{h.source === "manual" ? "✏️ Manual" : "🤖 Auto"}</span>
                {h.reason && <span className="text-[#9FB0A6] truncate max-w-[100px]">— {h.reason}</span>}
              </div>
              <span className="text-[#9FB0A6]">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}</span>
            </div>
          ))}
        </div>
      )}
      {showHistory && history.length === 0 && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-[#9FB0A6] text-center">
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
        <Loader2 className="w-5 h-5 text-[#6FE3B0] animate-spin" />
      </div>
    );
  }

  if (!breakdown) {
    return <div className="text-center py-12 text-[#9FB0A6]">Could not load score breakdown</div>;
  }

  const factorColors: Record<string, string> = {
    source: "#047857",
    latency: "#1B4332",
    timeline: "#B45309",
    budget: "#8B5CF6",
    propertyType: "#EC4899",
    callHour: "#06B6D4",
    territory: "#F97316",
    sentiment: "#DC2626",
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
      <div className="flex items-center gap-6 p-5 rounded-xl app-card">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle cx="36" cy="36" r="30" fill="none"
              stroke={breakdown.score >= 70 ? "#047857" : breakdown.score >= 40 ? "#B45309" : "#5C6B62"}
              strokeWidth="6" strokeDasharray={`${(breakdown.score / 100) * 188.5} 188.5`}
              strokeLinecap="round" className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold font-mono text-[#F0F7F3]">{breakdown.score}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="w-4 h-4 text-[#6FE3B0]" />
            <h3 className="text-sm font-semibold text-[#F0F7F3]">AI Score Analysis</h3>
          </div>
          <p className="text-[13px] text-[#9FB0A6] leading-relaxed">
            {breakdown.explanation}
          </p>
          <button onClick={handleRescore} disabled={rescoreLoading}
            className="mt-2 flex items-center gap-1.5 text-[12px] text-[#6FE3B0] hover:text-[#6FE3B0]/80 font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rescoreLoading ? "animate-spin" : ""}`} />
            {rescoreLoading ? "Recalculating..." : "Re-score this lead"}
          </button>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="p-5 rounded-xl app-card">
        <h3 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#6FE3B0]" />
          Factor Breakdown
          <span className="text-[11px] text-[#9FB0A6] font-normal ml-1">— weighted contribution to score</span>
        </h3>
        <div className="space-y-3">
          {sortedFactors.map(([key, value]) => {
            const label = breakdown.factorLabels[key];
            const color = factorColors[key] || "#5C6B62";
            const isPositive = value >= 0;
            const absValue = Math.abs(value);
            const maxPossible = key === "sentiment" ? 25 : 20;
            const barPercent = Math.min((absValue / maxPossible) * 100, 100);

            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0" style={{ color }}>
                  {factorIcons[key] || <Info className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-medium text-[#F0F7F3]">{label?.label || key}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[#9FB0A6]">{label?.weight || ""}</span>
                      <span className={cn(
                        "text-[13px] font-mono font-semibold",
                        isPositive ? "text-[#34D399]" : "text-[#FB7185]"
                      )}>
                        {isPositive ? "+" : ""}{absValue.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barPercent}%`, backgroundColor: isPositive ? color : "#E11D48" }}
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
        <div className="p-5 rounded-xl app-card">
          <h3 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#34D399]" />
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
                      backgroundColor: h.score >= 70 ? "#047857" : h.score >= 40 ? "#B45309" : "#5C6B62",
                      opacity: isLatest ? 1 : 0.6,
                    }}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/[0.06] text-[11px] text-[#F0F7F3] px-1.5 py-0.5 rounded whitespace-nowrap">
                      {h.score} — {h.source === "manual" ? "Manual" : "Auto"}
                    </div>
                  </div>
                  <span className="text-[9px] text-[#9FB0A6]">
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
        <div className="p-5 rounded-xl app-card">
          <div className="flex items-center gap-2 text-[#9FB0A6]">
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
    return <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin text-[#6FE3B0] mx-auto" /></div>;
  }

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <Home className="w-10 h-10 text-[#6B7C73] mx-auto mb-3" />
        <p className="text-sm text-[#9FB0A6]">No matching properties found</p>
        <p className="text-xs text-[#6B7C73] mt-1">Add more properties or wait for lead qualification data</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#9FB0A6]">{suggestions.length} matching properties</p>
        <span className="text-[11px] text-[#6FE3B0]">Match Score →</span>
      </div>
      {suggestions.map((prop: any) => (
        <div key={prop.propertyId}
          className="p-4 rounded-xl app-card border-l-4"
          style={{
            borderLeftColor: prop.score >= 70 ? "#047857" : prop.score >= 40 ? "#B45309" : "#5C6B62",
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="text-sm font-semibold text-[#F0F7F3]">{prop.propertyName}</h4>
              <p className="text-xs text-[#9FB0A6]">{prop.propertyLocation || "—"}</p>
            </div>
            <div className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-bold font-mono",
              prop.score >= 70 ? "bg-[#34D399]/25 text-[#34D399]" :
              prop.score >= 40 ? "bg-[#B45309]/20 text-[#E8C468]" :
              "bg-[#5C6B62]/20 text-[#9FB0A6]"
            )}>
              {prop.score}%
            </div>
          </div>
          {prop.propertyPrice && (
            <p className="text-sm text-[#F0F7F3] font-mono mb-2">
              ₹{(prop.propertyPrice / 100000).toFixed(1)}L
            </p>
          )}
          {prop.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prop.matchReasons.slice(0, 3).map((reason: string, i: number) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-[#9FB0A6] border border-white/10">
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
        className="w-full px-4 py-3 rounded-xl app-card text-sm text-[#F0F7F3] placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/50 resize-none"
      />
      <button onClick={handleSave} disabled={!note.trim() || saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#1B4332] to-[#1B4332]/80 text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-all"
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Note"}
      </button>
    </div>
  );
}

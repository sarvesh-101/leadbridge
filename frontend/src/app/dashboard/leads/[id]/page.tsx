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
  CheckCircle2, XCircle, Edit3, Loader2,
} from "lucide-react";
import { LeadStatusBadge } from "@/components/shared/LeadStatusBadge";

type Tab = "overview" | "calls" | "booking" | "messages" | "notes";

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
    { id: "calls", label: "Calls", icon: <Phone className="w-4 h-4" /> },
    { id: "booking", label: "Booking", icon: <Calendar className="w-4 h-4" /> },
    { id: "messages", label: "Messages", icon: <MessageSquare className="w-4 h-4" /> },
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

      {/* Score bar */}
      {lead.score > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#111118] border border-[#2A2A3A]">
          <span className="text-sm text-[#6B6B8A]">Conversion Score</span>
          <div className="flex-1 h-2 rounded-full bg-[#1A1A24] overflow-hidden">
            <div className={cn(
              "h-full rounded-full transition-all duration-500",
              lead.score >= 70 ? "bg-[#22D3A5]" : lead.score >= 40 ? "bg-[#F59E0B]" : "bg-[#6B6B8A]"
            )} style={{ width: `${lead.score}%` }} />
          </div>
          <span className="text-lg font-bold font-mono text-white">{lead.score}</span>
        </div>
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

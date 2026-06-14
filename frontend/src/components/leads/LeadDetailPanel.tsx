"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Phone, Calendar, MessageSquare, FileText, Activity,
  MapPin, DollarSign, Clock, ThumbsUp, ThumbsDown, Meh,
  CheckCircle2, XCircle, Edit3,
} from "lucide-react";
import { LeadStatusBadge } from "../shared/LeadStatusBadge";
import { cn } from "../../lib/utils";
import type { Lead, LeadStatus, Call, Booking, CustomerNotification } from "../../types";

interface LeadDetailPanelProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}

type Tab = "overview" | "calls" | "booking" | "messages" | "notes";

export function LeadDetailPanel({ lead, open, onClose }: LeadDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <FileText className="w-4 h-4" /> },
    { id: "calls", label: "Calls", icon: <Phone className="w-4 h-4" /> },
    { id: "booking", label: "Booking", icon: <Calendar className="w-4 h-4" /> },
    { id: "messages", label: "Messages", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "notes", label: "Notes", icon: <Edit3 className="w-4 h-4" /> },
  ];

  // Format date helper
  const fmt = (d: string | undefined | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return "—"; }
  };

  return (
    <AnimatePresence>
      {open && lead && (
        <>
          {/* Mobile overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 xl:hidden"
            onClick={onClose}
          />

          {/* Slide-in panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-[#111118] border-l border-[#2A2A3A] shadow-2xl z-50 overflow-hidden xl:absolute xl:right-0 xl:top-0 xl:bottom-0 xl:z-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A3A]">
              <div className="flex-1 min-w-0">
                <h2 className="text-[16px] font-semibold text-[#F0F0F8] truncate">
                  {lead.name}
                </h2>
                <p className="text-[12px] text-[#6B6B8A] font-mono">{lead.phone}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[#1A1A24] transition-colors"
              >
                <X className="w-4 h-4 text-[#6B6B8A]" />
              </button>
            </div>

            {/* Meta bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2A2A3A]">
              <LeadStatusBadge status={lead.status as LeadStatus} pulse={lead.status === "CALLING"} />
              <span className="text-[12px] px-2 py-0.5 rounded bg-[#1A1A24] text-[#6B6B8A] border border-[#2A2A3A]">
                {lead.source}
              </span>
              {lead.score > 0 && (
                <span className={cn(
                  "text-[12px] px-2 py-0.5 rounded border",
                  lead.score >= 70 ? "bg-[#22D3A5]/10 text-[#22D3A5] border-[#22D3A5]/30" :
                  lead.score >= 40 ? "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30" :
                  "bg-[#1A1A24] text-[#6B6B8A] border-[#2A2A3A]"
                )}>
                  Score: {lead.score}
                </span>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#2A2A3A] px-3 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors shrink-0",
                    activeTab === tab.id
                      ? "border-[#4F6EF7] text-[#4F6EF7]"
                      : "border-transparent text-[#6B6B8A] hover:text-[#F0F0F8]"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto h-[calc(100%-180px)]">
              {activeTab === "overview" && <OverviewTab lead={lead} fmt={fmt} />}
              {activeTab === "calls" && <CallsTab lead={lead} fmt={fmt} />}
              {activeTab === "booking" && <BookingTab lead={lead} fmt={fmt} />}
              {activeTab === "messages" && <MessagesTab lead={lead} fmt={fmt} />}
              {activeTab === "notes" && <NotesTab />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Overview Tab ─────────────────────────────────────────────── */
function OverviewTab({ lead, fmt }: { lead: Lead; fmt: (d: string | undefined | null) => string }) {
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
    <div className="p-5 space-y-5">
      {/* Qualification Grid */}
      <div className="grid grid-cols-2 gap-3">
        {qualFields.map((field) => (
          <div key={field.label} className="flex items-start gap-3 p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A]">
            <div className="mt-0.5 text-[#6B6B8A]">{field.icon}</div>
            <div>
              <p className="text-[11px] text-[#6B6B8A] caption">{field.label}</p>
              <p className="text-[13px] font-medium text-[#F0F0F8]">{field.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div className="p-4 rounded-lg bg-[#1A1A24] border-l-[3px] border-[#4F6EF7]">
        <p className="text-[12px] italic text-[#6B6B8A]">
          {lead.score >= 70
            ? "High-intent buyer — ready to close. Recommended: priority call and site visit scheduling."
            : lead.score >= 40
            ? "Moderate interest — needs follow-up. Budget and timeline confirmed, proceed with visit booking."
            : "Low engagement — requires re-engagement sequence. Consider sending WhatsApp follow-up."}
        </p>
      </div>

      {/* Timeline */}
      <div>
        <h4 className="caption mb-3">Timeline</h4>
        <div className="space-y-0">
          {timeline.map((item, i) => (
            <div key={i} className="flex items-start gap-3 pb-3 relative">
              {i < timeline.length - 1 && (
                <div className="absolute left-[11px] top-5 bottom-0 w-px bg-[#2A2A3A]" />
              )}
              <div className="mt-0.5 text-[#6B6B8A] bg-[#1A1A24] rounded-full p-1">
                {item.icon}
              </div>
              <div>
                <p className="text-[13px] text-[#F0F0F8]">{item.event}</p>
                <p className="text-[12px] text-[#6B6B8A]">{fmt(item.date)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        {lead.status === "REMINDED" && (
          <button className="flex-1 px-4 py-2 rounded-lg bg-[#22D3A5] hover:brightness-110 text-black text-[13px] font-semibold transition-all">
            Mark Visited
          </button>
        )}
        {(lead.status === "VISITED" || lead.status === "BOOKED") && (
          <button className="flex-1 px-4 py-2 rounded-lg bg-[#22D3A5] hover:brightness-110 text-black text-[13px] font-semibold transition-all">
            Mark Converted
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Calls Tab ────────────────────────────────────────────────── */
function CallsTab({ lead, fmt }: { lead: Lead; fmt: (d: string | undefined | null) => string }) {
  const calls = (lead.calls || []) as Call[];
  if (calls.length === 0) {
    return (
      <div className="p-5 text-center text-[#6B6B8A]">
        <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-[13px]">No calls yet</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {calls.map((call) => (
        <div key={call.id} className="p-4 rounded-lg bg-[#1A1A24] border border-[#2A2A3A]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-[#6B6B8A] font-medium">{call.type}</span>
            <span className={cn(
              "text-[11px] font-medium px-2 py-0.5 rounded",
              call.status === "COMPLETED" ? "bg-[#22D3A5]/10 text-[#22D3A5]" :
              call.status === "FAILED" || call.status === "NO_ANSWER" ? "bg-[#F43F5E]/10 text-[#F43F5E]" :
              "bg-[#4F6EF7]/10 text-[#4F6EF7]"
            )}>
              {call.status}
            </span>
          </div>
          <p className="text-[12px] text-[#6B6B8A]">{fmt(call.createdAt)}</p>
          {call.duration && <p className="text-[12px] text-[#6B6B8A] mt-1">{call.duration}s duration</p>}
          {call.summary && (
            <details className="mt-2">
              <summary className="text-[12px] font-medium text-[#4F6EF7] cursor-pointer">View summary</summary>
              <p className="text-[13px] text-[#6B6B8A] mt-2">{call.summary}</p>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Booking Tab ──────────────────────────────────────────────── */
function BookingTab({ lead, fmt }: { lead: Lead; fmt: (d: string | undefined | null) => string }) {
  const booking = lead.booking as Booking | undefined;
  if (!booking) {
    return (
      <div className="p-5 text-center text-[#6B6B8A]">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-[13px]">No visit booked yet</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="p-5 rounded-lg bg-[#22D3A5]/10 border border-[#22D3A5]/30">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[#22D3A5]" />
          <h3 className="text-[15px] font-semibold text-[#F0F0F8]">Visit Scheduled</h3>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[24px] font-display font-bold text-[#F0F0F8]">
              {booking.visitDate ? new Date(booking.visitDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "—"}
            </p>
            <p className="text-[15px] text-[#22D3A5] font-medium">{booking.visitTime}</p>
          </div>

          {booking.propertyAddress && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#6B6B8A] mt-0.5" />
              <p className="text-[13px] text-[#6B6B8A]">{booking.propertyAddress}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button className="px-4 py-2 rounded-lg bg-[#22D3A5] hover:brightness-110 text-black text-[13px] font-semibold transition-all">
            Mark as Visited
          </button>
          <button className="px-4 py-2 rounded-lg border border-[#2A2A3A] text-[#6B6B8A] hover:text-[#F0F0F8] hover:bg-[#1A1A24] text-[13px] font-medium transition-all">
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Messages Tab ─────────────────────────────────────────────── */
function MessagesTab({ lead, fmt }: { lead: Lead; fmt: (d: string | undefined | null) => string }) {
  const notifications = (lead.customerNotifications || []) as CustomerNotification[];
  if (notifications.length === 0) {
    return (
      <div className="p-5 text-center text-[#6B6B8A]">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-[13px]">No messages sent yet</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {notifications.map((n) => (
        <div key={n.id} className="p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] font-medium text-[#6B6B8A]">{n.type} · {n.channel}</span>
            <span className={cn(
              "text-[11px] px-1.5 py-0.5 rounded",
              n.status === "sent" || n.status === "delivered" ? "bg-[#22D3A5]/10 text-[#22D3A5]" :
              "bg-[#F43F5E]/10 text-[#F43F5E]"
            )}>
              {n.status}
            </span>
          </div>
          <p className="text-[13px] text-[#F0F0F8] line-clamp-2">{n.message}</p>
          <p className="text-[11px] text-[#6B6B8A] mt-1">{fmt(n.sentAt)}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Notes Tab ────────────────────────────────────────────────── */
function NotesTab() {
  const [note, setNote] = useState("");

  return (
    <div className="p-5 space-y-4">
      <textarea
        placeholder="Add a note about this lead..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full h-32 px-4 py-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-[13px] text-[#F0F0F8] placeholder-[#3A3A52] focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7] resize-none transition-colors"
      />
      <button
        disabled={!note.trim()}
        className="w-full px-4 py-2 rounded-lg bg-[#4F6EF7] hover:brightness-110 text-white text-[13px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save Note
      </button>
      <p className="text-[12px] text-[#6B6B8A] text-center italic">
        Notes are visible to your team only
      </p>
    </div>
  );
}

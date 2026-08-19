"use client";

import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Phone, ChevronDown, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { Call } from "@/types";

interface CallCardProps {
  call: Call;
}

export function CallCard({ call }: CallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = call.status === "COMPLETED";
  const isFailed = call.status === "FAILED" || call.status === "NO_ANSWER";

  return (
    <div className="rounded-lg bg-[#FFFFFF] border border-[#E4E7DF] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#F1F3EE] transition-colors text-left"
      >
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            isSuccess ? "bg-[#047857]/10" : isFailed ? "bg-[#E11D48]/10" : "bg-[#1B4332]/10"
          )}>
            <Phone className={cn(
              "w-4 h-4",
              isSuccess ? "text-[#047857]" : isFailed ? "text-[#E11D48]" : "text-[#1B4332]"
            )} />
          </div>

          <div>
            {/* Type badge + date */}
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[12px] px-2 py-0.5 rounded bg-[#F1F3EE] text-[#5C6B62] border border-[#E4E7DF] font-medium">
                {call.type}
              </span>
              <span className="text-[12px] text-[#5C6B62]">{formatDate(call.createdAt)}</span>
            </div>

            {/* Outcome */}
            <span className={cn(
              "text-[13px] font-medium",
              isSuccess ? "text-[#047857]" : isFailed ? "text-[#E11D48]" : "text-[#B45309]"
            )}>
              {call.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {call.duration && (
            <div className="flex items-center gap-1 text-[12px] text-[#5C6B62]">
              <Clock className="w-3 h-3" />
              {call.duration}s
            </div>
          )}
          <ChevronDown className={cn(
            "w-4 h-4 text-[#5C6B62] transition-transform duration-200",
            expanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* Expanded: Summary + Transcript */}
      {expanded && (
        <div className="border-t border-[#E4E7DF]">
          {call.summary && (
            <div className="p-4 bg-[#F1F3EE] border-b border-[#E4E7DF]">
              <p className="text-[12px] text-[#5C6B62] mb-1">Summary</p>
              <p className="text-[13px] text-[#1E2B24]">{call.summary}</p>
            </div>
          )}
          {call.transcript ? (
            <div className="p-4">
              <p className="text-[12px] text-[#5C6B62] mb-3">Transcript</p>
              <TranscriptViewer transcript={call.transcript} />
            </div>
          ) : (
            <div className="p-4 text-center text-[12px] text-[#5C6B62]">
              No transcript available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── TranscriptViewer ─────────────────────────────────────────── */
function TranscriptViewer({ transcript }: { transcript: string }) {
  const lines = transcript.split("\n").filter(Boolean);
  if (lines.length === 0) {
    return <p className="text-[12px] text-[#5C6B62] text-center">No transcript lines</p>;
  }

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const isAI = line.toLowerCase().startsWith("ai:") || line.toLowerCase().startsWith("assistant:");
        const isCustomer = line.toLowerCase().startsWith("customer:") || line.toLowerCase().startsWith("lead:");
        const speaker = isAI ? "AI" : isCustomer ? "Customer" : null;

        if (!speaker) {
          return (
            <p key={i} className="text-[12px] text-[#5C6B62] italic px-2">{line}</p>
          );
        }

        const text = line.replace(/^(AI|Assistant|Customer|Lead):\s*/i, "");

        return (
          <div
            key={i}
            className={cn(
              "flex",
              speaker === "AI" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] px-3 py-2 rounded-lg text-[13px] leading-relaxed",
                speaker === "AI"
                  ? "bg-[#F1F3EE] text-[#1E2B24] rounded-br-sm"
                  : "bg-[#1B433240] text-[#1E2B24] border border-[#1B4332] rounded-bl-sm"
              )}
            >
              <span className={cn(
                "text-[10px] font-medium block mb-0.5",
                speaker === "AI" ? "text-[#1B4332] text-right" : "text-[#047857]"
              )}>
                {speaker}
              </span>
              {text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

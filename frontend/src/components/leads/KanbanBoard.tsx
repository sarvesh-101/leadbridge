"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import Link from "next/link";
import type { Lead, LeadStatus } from "@/types";

const PIPELINE_COLUMNS: { id: LeadStatus; label: string; color: string }[] = [
  { id: "PENDING", label: "New Leads", color: "bg-blue-500/20 border-blue-500/30" },
  { id: "CALLING", label: "Calling", color: "bg-amber-500/20 border-amber-500/30" },
  { id: "FAQ_ONLY", label: "FAQ Only", color: "bg-purple-500/20 border-purple-500/30" },
  { id: "BOOKED", label: "Visit Booked", color: "bg-green-500/20 border-green-500/30" },
  { id: "VISITED", label: "Visited", color: "bg-emerald-500/20 border-emerald-500/30" },
  { id: "CONVERTED", label: "Converted", color: "bg-emerald-400/20 border-emerald-400/30" },
  { id: "COLD", label: "Cold", color: "bg-gray-500/20 border-gray-500/30" },
];

interface KanbanBoardProps {
  leads: Lead[];
  loading?: boolean;
}

export function KanbanBoard({ leads, loading }: KanbanBoardProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [columns, setColumns] = useState<Record<string, Lead[]>>({});
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  useEffect(() => {
    const grouped: Record<string, Lead[]> = {};
    for (const col of PIPELINE_COLUMNS) {
      grouped[col.id] = [];
    }
    for (const lead of leads) {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      } else {
        grouped["PENDING"].push(lead);
      }
    }
    setColumns(grouped);
  }, [leads]);

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: LeadStatus) => {
    if (!draggedLead) return;
    const leadId = draggedLead;
    setDraggedLead(null);

    // Optimistic update
    setColumns((prev) => {
      const newCols = { ...prev };
      let movedLead: Lead | null = null;
      for (const [colId, leads] of Object.entries(newCols)) {
        const idx = leads.findIndex((l) => l.id === leadId);
        if (idx !== -1) {
          movedLead = leads[idx];
          newCols[colId] = leads.filter((l) => l.id !== leadId);
          break;
        }
      }
      if (movedLead) {
        const updatedLead = { ...movedLead, status };
        if (!newCols[status]) newCols[status] = [];
        newCols[status] = [...newCols[status], updatedLead];
      }
      return newCols;
    });

    // Persist to backend
    try {
      await api.patch(`/leads/${leadId}/status`, { status });
    } catch {
      toast.error("Failed to update status");
    }
  };

  const getLeadColor = (lead: Lead) => {
    if (lead.score >= 80) return "border-l-[#22D3A5]";
    if (lead.score >= 60) return "border-l-[#4F6EF7]";
    if (lead.score >= 40) return "border-l-[#F59E0B]";
    return "border-l-[#6B6B8A]";
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.slice(0, 4).map((col) => (
          <div key={col.id} className="flex-shrink-0 w-72 space-y-3">
            <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
      {PIPELINE_COLUMNS.map((column) => {
        const columnLeads = columns[column.id] || [];
        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={cn("w-2.5 h-2.5 rounded-full", column.color.split(" ")[0])} />
                <h3 className="text-sm font-semibold text-white">{column.label}</h3>
              </div>
              <span className="text-xs text-[#6B6B8A] font-mono bg-[#1A1A24] px-2 py-0.5 rounded-full">
                {columnLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2 min-h-[100px]">
              {columnLeads.slice(0, 20).map((lead) => (
                <motion.div
                  key={lead.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  draggable
                  onDragStart={() => handleDragStart(lead.id)}
                  className={cn(
                    "p-3 rounded-xl bg-[#111118] border border-[#2A2A3A] border-l-4 cursor-grab active:cursor-grabbing hover:border-[#4F6EF7]/50 transition-all",
                    getLeadColor(lead)
                  )}
                >
                  <Link href={`/dashboard/leads/${lead.id}`} className="block">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4F6EF7] to-[#4F6EF7]/60 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-white">
                          {lead.name[0].toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-white truncate flex-1">{lead.name}</span>
                      {lead.score > 0 && (
                        <span className={cn(
                          "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                          lead.score >= 80 ? "bg-[#22D3A5]/20 text-[#22D3A5]" :
                          lead.score >= 60 ? "bg-[#4F6EF7]/20 text-[#4F6EF7]" :
                          "bg-[#F59E0B]/20 text-[#F59E0B]"
                        )}>
                          {lead.score}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#6B6B8A]">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {lead.phone.slice(-4)}
                      </span>
                      <span>{lead.source}</span>
                    </div>
                    {lead.budget && (
                      <p className="text-[11px] text-[#6B6B8A] mt-1">💰 {lead.budget}</p>
                    )}
                  </Link>
                </motion.div>
              ))}
              {columnLeads.length === 0 && (
                <div className="p-4 rounded-xl border border-dashed border-[#2A2A3A] text-center">
                  <p className="text-[11px] text-[#3A3A52]">Drop leads here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

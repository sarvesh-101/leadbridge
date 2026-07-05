"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { LayoutList } from "lucide-react";
import type { Lead, LeadFilterState } from "@/types";
import Link from "next/link";

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<LeadFilterState>({
    search: "", status: [], source: [], dateFrom: "", dateTo: "",
  });

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filters.search) params.set("search", filters.search);
      if (filters.status.length > 0) params.set("status", filters.status.join(","));
      if (filters.source.length > 0) params.set("source", filters.source.join(","));
      if (filters.dateFrom) params.set("from", filters.dateFrom);
      if (filters.dateTo) params.set("to", filters.dateTo);

      const data = await api.get(`/leads?${params.toString()}`);
      setLeads(data.leads);
    } catch {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-sm text-gray-400 mt-1">Drag & drop leads to update their status</p>
        </div>
        <Link href="/dashboard/leads"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all"
        >
          <LayoutList className="w-4 h-4" />
          <span className="hidden sm:inline">Table View</span>
        </Link>
      </div>

      {/* Filters */}
      <LeadFilters
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
        }}
      />

      {/* Kanban Board */}
      <KanbanBoard leads={leads} loading={loading} />
    </div>
  );
}

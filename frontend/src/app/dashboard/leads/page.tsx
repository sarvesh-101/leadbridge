"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { LeadTable } from "../../../components/leads/LeadTable";
import { LeadFilters } from "../../../components/leads/LeadFilters";
import { LeadDetailPanel } from "../../../components/leads/LeadDetailPanel";
import { api } from "../../../lib/api";
import { useLeadStatusUpdates } from "../../../lib/websocket";
import type { Lead, LeadFilterState, LeadStatus } from "../../../types";
import { useAuthStore } from "../../../stores/auth.store";
import { exportToCSV, EXPORT_HEADERS } from "../../../lib/csv-export";

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LeadFilterState>({
    search: "", status: [], source: [], dateFrom: "", dateTo: "",
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 20;

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (filters.search) params.set("search", filters.search);
      if (filters.status.length > 0) params.set("status", filters.status.join(","));
      if (filters.source.length > 0) params.set("source", filters.source.join(","));
      if (filters.dateFrom) params.set("from", filters.dateFrom);
      if (filters.dateTo) params.set("to", filters.dateTo);

      const data = await api.get(`/leads?${params.toString()}`);
      setLeads(data.leads);
      setTotal(data.total);
    } catch (err) {
      toast.error("Failed to load leads")
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Real-time status updates
  useLeadStatusUpdates((leadId, newStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus as LeadStatus } : l))
    );
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, status: newStatus as LeadStatus } : prev);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} total leads
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              exportToCSV(leads, `leads-export-${new Date().toISOString().split("T")[0]}`, EXPORT_HEADERS.leads);
              toast.success(`${leads.length} leads exported`);
            }}
            disabled={leads.length === 0}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-600 text-gray-300 text-xs sm:text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-xs sm:text-sm font-medium hover:opacity-90 transition-all">
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>
        </div>
      </div>

      <LeadFilters
        onFilterChange={(newFilters) => {
          setFilters(newFilters);
          setPage(1);
        }}
      />

      <LeadTable
        leads={leads}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onLeadClick={(lead) => {
          setSelectedLead(lead);
          setPanelOpen(true);
        }}
        loading={loading}
      />

      <LeadDetailPanel
        lead={selectedLead}
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedLead(null);
        }}
      />
    </div>
  );
}

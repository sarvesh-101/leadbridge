"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { BulkActionBar } from "../../../components/leads/BulkActionBar";
import { AddLeadModal } from "../../../components/leads/AddLeadModal";

function LeadsPageContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<LeadFilterState>({
    search: urlSearch, status: [], source: [], dateFrom: "", dateTo: "",
  });
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionKey, setSelectionKey] = useState(0);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 50;

  // Build the query for the current filter set — shared by loadLeads and the
  // full export so both honor exactly what the broker is looking at.
  const buildLeadsQuery = (pageNum: number) => {
    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    params.set("limit", String(PAGE_SIZE));
    if (filters.search) params.set("search", filters.search);
    if (filters.status.length > 0) params.set("status", filters.status.join(","));
    if (filters.source.length > 0) params.set("source", filters.source.join(","));
    if (filters.dateFrom) params.set("from", filters.dateFrom);
    if (filters.dateTo) params.set("to", filters.dateTo);
    return params.toString();
  };

  // FIX (2026-10-18): export the ENTIRE filtered result set, not just the
  // currently loaded page (≤50 rows). Brokers with hundreds of leads were
  // silently getting partial CSVs with no indication anything was missing.
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const allLeads: Lead[] = [];
      let pageNum = 1;
      const MAX_PAGES = 20; // 50/page → hard cap of 1000 rows per export
      while (pageNum <= MAX_PAGES) {
        const data = await api.get<{ leads?: Lead[]; total?: number }>(
          `/leads?${buildLeadsQuery(pageNum)}`
        );
        const batch = data.leads ?? [];
        allLeads.push(...batch);
        if (batch.length === 0 || allLeads.length >= (data.total ?? allLeads.length)) break;
        pageNum++;
      }
      if (allLeads.length === 0) {
        toast.error("No leads match the current filters");
        return;
      }
      exportToCSV(allLeads, `leads-export-${new Date().toISOString().split("T")[0]}`, EXPORT_HEADERS.leads);
      toast.success(`${allLeads.length} leads exported`);
    } catch {
      toast.error("Failed to export leads");
    } finally {
      setExporting(false);
    }
  };

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildLeadsQuery(page);

      const data = await api.get(`/leads?${params}`);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-[#F0F7F3]">Leads</h1>
          <p className="text-sm text-[#9FB0A6] dark:text-[#9FB0A6]">
            {total} total leads
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleExportCSV}
            disabled={leads.length === 0 || exporting}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg border border-gray-600 text-[#9FB0A6] text-xs sm:text-sm font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={() => setAddLeadOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-xs sm:text-sm font-medium hover:opacity-90 transition-all"
          >
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedIds={selectedIds}
        onClear={() => { setSelectedIds([]); setSelectionKey(k => k + 1); }}
        onComplete={() => { loadLeads(); setSelectedIds([]); setSelectionKey(k => k + 1); }}
      />

      <LeadTable
        key={selectionKey}
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
        onSelectionChange={setSelectedIds}
      />

      <LeadDetailPanel
        lead={selectedLead}
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedLead(null);
        }}
      />

      <AddLeadModal
        open={addLeadOpen}
        onClose={() => setAddLeadOpen(false)}
        onCreated={() => {
          setPage(1);
          loadLeads();
        }}
      />
    </div>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-48"><Loader2 className="w-8 h-8 text-[#6FE3B0] animate-spin" /></div>}>
      <LeadsPageContent />
    </Suspense>
  );
}

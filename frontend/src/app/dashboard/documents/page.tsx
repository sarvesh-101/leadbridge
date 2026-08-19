"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  FileText, Search, Upload, Download, CheckCircle2,
  XCircle, Clock, Filter, Loader2, FileType, ExternalLink,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Lead } from "@/types";

interface DocumentItem {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "UPLOADED" | "VERIFIED" | "REJECTED";
  notes?: string;
  uploadedBy: string;
  uploadedAt: string;
  verifiedAt?: string;
  url?: string;
  leadId: string;
  lead?: { name: string; phone: string };
}

const DOC_TYPE_LABELS: Record<string, string> = {
  aadhar: "Aadhaar Card",
  pan: "PAN Card",
  passport: "Passport",
  voter_id: "Voter ID",
  driving_license: "Driving License",
  income_proof: "Income Proof",
  bank_statement: "Bank Statement",
  property_document: "Property Document",
  other: "Other",
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes] = await Promise.all([
        api.get<{ leads: Lead[]; total: number }>("/leads?limit=100&page=1"),
      ]);
      setLeads(leadsRes.leads || []);

      // Load documents for all leads (simplified — in real app, would have a bulk endpoint)
      const allDocs: DocumentItem[] = [];
      for (const lead of (leadsRes.leads || []).slice(0, 20)) {
        try {
          const docsRes = await api.get<{ documents: DocumentItem[] }>(`/leads/${lead.id}/documents`);
          if (docsRes.documents?.length) {
            allDocs.push(...docsRes.documents.map(d => ({ ...d, leadId: lead.id, lead: { name: lead.name, phone: lead.phone } })));
          }
        } catch { /* skip leads without docs */ }
      }
      setDocuments(allDocs);
    } catch (err: any) {
      toast.error(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = documents.filter((d) => {
    const matchSearch = !search || d.fileName.toLowerCase().includes(search.toLowerCase()) ||
      d.lead?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const verifiedCount = documents.filter((d) => d.status === "VERIFIED").length;
  const pendingCount = documents.filter((d) => d.status === "UPLOADED").length;

  async function handleUpload() {
    if (!selectedLeadId) return toast.error("Select a lead first");
    setUploading(true);
    try {
      // In a real app, this would open a file picker dialog
      toast.success("Document upload feature — use lead detail page for full upload support");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleVerify(docId: string, leadId: string, verified: boolean) {
    try {
      await api.patch(`/leads/${leadId}/documents/${docId}/verify`, { verified });
      toast.success(verified ? "Document verified" : "Document rejected");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update document");
    }
  }

  async function handleDelete(docId: string, leadId: string) {
    try {
      await api.delete(`/leads/${leadId}/documents/${docId}`);
      toast.success("Document deleted");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "VERIFIED": return "bg-green-500/10 text-green-400";
      case "UPLOADED": return "bg-amber-500/10 text-amber-400";
      case "REJECTED": return "bg-red-500/10 text-red-400";
      default: return "bg-gray-500/10 text-[#9FB0A6]";
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "aadhar": case "pan": case "passport": case "voter_id": case "driving_license":
        return <FileType className="w-4 h-4 text-blue-400" />;
      default: return <FileText className="w-4 h-4 text-[#9FB0A6]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F7F3]">Lead Documents</h1>
          <p className="text-[#9FB0A6] mt-1">Manage KYC documents uploaded by leads</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Documents", value: documents.length, icon: FileText, color: "text-blue-400" },
          { label: "Verified", value: verifiedCount, icon: CheckCircle2, color: "text-green-400" },
          { label: "Pending Review", value: pendingCount, icon: Clock, color: "text-amber-400" },
          { label: "Leads with Docs", value: new Set(documents.map(d => d.lead?.name)).size, icon: FileText, color: "text-purple-400" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl app-card">
            {loading ? (
              <div className="animate-pulse"><div className="h-7 w-12 bg-white/[0.06] rounded" /></div>
            ) : (
              <>
                <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
                <div className="text-xl font-bold text-[#F0F7F3]">{s.value}</div>
                <div className="text-xs text-[#9FB0A6]">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9FB0A6]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name or lead name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/50/50"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl app-card text-[#9FB0A6] text-sm"
        >
          <option value="all">All Status</option>
          <option value="UPLOADED">Pending</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-[#101713] rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? "No documents match your search" : "No documents yet"}
          description="Documents uploaded by leads through the customer portal will appear here"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((doc, i) => (
            <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] transition-all"
            >
              <div className="w-10 h-10 rounded-xl app-card flex items-center justify-center shrink-0">
                {typeIcon(doc.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-[#F0F7F3] truncate">{doc.fileName}</span>
                  <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full", statusColor(doc.status))}>
                    {doc.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#9FB0A6] mt-0.5">
                  <span>{DOC_TYPE_LABELS[doc.type] || doc.type}</span>
                  {doc.lead?.name && <span>• {doc.lead.name}</span>}
                  <span>• {(doc.fileSize / 1024).toFixed(0)} KB</span>
                  <span>• {formatDate(doc.uploadedAt)}</span>
                </div>
                {doc.notes && <p className="text-xs text-gray-600 mt-1">{doc.notes}</p>}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {doc.status === "UPLOADED" && (
                  <>
                    <button onClick={() => handleVerify(doc.id, doc.leadId, true)}
                      className="p-2 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors" title="Verify">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleVerify(doc.id, doc.leadId, false)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Reject">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg text-[#9FB0A6] hover:text-[#F0F7F3] hover:bg-white/[0.06] transition-colors" title="View">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button onClick={() => handleDelete(doc.id, doc.leadId)}
                  className="p-2 rounded-lg text-[#9FB0A6] hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

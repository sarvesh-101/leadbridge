"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertCircle, Loader2, ArrowRight, ChevronDown, ChevronUp,
  Users, AlertTriangle, ListChecks,
} from "lucide-react";

interface PreviewRow {
  name: string;
  phone: string;
  email: string;
  source: string;
}

interface PreviewData {
  total: number;
  valid: number;
  duplicates: number;
  errors: number;
  errorDetails: Array<{ row: number; message: string }>;
  duplicateDetails: Array<{ name: string; phone: string }>;
  preview: PreviewRow[];
  filename: string;
  totalRows: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  message: string;
}

export default function ImportLeadsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      return toast.error("Only CSV files are supported");
    }

    setFile(selectedFile);
    setImportResult(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const data = await api.post("/leads/import/preview", formData, {
        headers: {} as Record<string, string>,
      } as any);
      setPreview(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to parse CSV");
      setFile(null);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await api.post("/leads/import/execute", formData, {
        headers: {} as Record<string, string>,
      } as any);
      setImportResult(data);
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleDownloadSample() {
    try {
      const { useAuthStore } = await import("@/stores/auth.store");
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1"}/leads/import/sample`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "leadbridge-sample-import.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Sample CSV downloaded");
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setShowErrors(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Import Leads</h1>
          <p className="text-gray-400 mt-1">Bulk upload leads from a CSV file</p>
        </div>
        <button onClick={handleDownloadSample}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-all"
        >
          <Download className="w-4 h-4" />
          Download Sample CSV
        </button>
      </div>

      {/* Instructions */}
      <div className="p-4 rounded-xl bg-[#4F6EF7]/5 border border-[#4F6EF7]/10">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 text-[#4F6EF7] mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-white mb-1">CSV Format</h3>
            <p className="text-xs text-gray-400">
              Columns: <code className="text-[#4F6EF7]">name</code> (required),{" "}
              <code className="text-[#4F6EF7]">phone</code> (required),{" "}
              <code className="text-gray-500">email</code>,{" "}
              <code className="text-gray-500">source</code>,{" "}
              <code className="text-gray-500">budget</code>,{" "}
              <code className="text-gray-500">location</code>,{" "}
              <code className="text-gray-500">timeline</code>,{" "}
              <code className="text-gray-500">propertyType</code>,{" "}
              <code className="text-gray-500">bedrooms</code>,{" "}
              <code className="text-gray-500">notes</code>
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Max 500 leads per import. Duplicates (same phone in last 30 days) are auto-skipped.
            </p>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      {!preview && !importResult && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative p-12 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all",
            dragOver
              ? "border-[#4F6EF7] bg-[#4F6EF7]/5"
              : "border-white/10 bg-white/5 hover:border-[#4F6EF7]/30 hover:bg-white/10"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
          {loading ? (
            <Loader2 className="w-12 h-12 text-[#4F6EF7] mx-auto mb-4 animate-spin" />
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-1">
                Drop your CSV here
              </h3>
              <p className="text-sm text-gray-500">or click to browse files</p>
              <p className="text-xs text-gray-600 mt-2">Supports .csv files up to 10MB</p>
            </>
          )}
        </div>
      )}

      {/* Preview */}
      <AnimatePresence>
        {preview && !importResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Rows", value: preview.total, icon: ListChecks, color: "text-blue-400" },
                { label: "Valid to Import", value: preview.valid, icon: CheckCircle2, color: "text-green-400" },
                { label: "Duplicates", value: preview.duplicates, icon: AlertTriangle, color: preview.duplicates > 0 ? "text-amber-400" : "text-gray-500" },
                { label: "Errors", value: preview.errors, icon: XCircle, color: preview.errors > 0 ? "text-red-400" : "text-gray-500" },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <s.icon className={cn("w-5 h-5 mb-1", s.color)} />
                  <div className="text-xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Errors */}
            {preview.errorDetails.length > 0 && (
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                <button onClick={() => setShowErrors(!showErrors)} className="flex items-center justify-between w-full">
                  <span className="text-sm text-red-400 font-medium">{preview.errorDetails.length} rows with errors</span>
                  {showErrors ? <ChevronUp className="w-4 h-4 text-red-400" /> : <ChevronDown className="w-4 h-4 text-red-400" />}
                </button>
                {showErrors && (
                  <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                    {preview.errorDetails.map((err, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-red-300">
                        <XCircle className="w-3 h-3 shrink-0" />
                        <span>Row {err.row}: {err.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Duplicates */}
            {preview.duplicateDetails.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-sm text-amber-400 font-medium mb-2">
                  {preview.duplicateDetails.length} existing leads (skipped)
                </p>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {preview.duplicateDetails.map((d, i) => (
                    <div key={i} className="text-xs text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {d.name} — {d.phone}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Table */}
            {preview.preview.length > 0 && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Preview ({preview.preview.length} of {preview.valid} rows)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-500">
                        <th className="text-left py-2 pr-4">Name</th>
                        <th className="text-left py-2 pr-4">Phone</th>
                        <th className="text-left py-2 pr-4">Email</th>
                        <th className="text-left py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 text-gray-300">
                          <td className="py-2 pr-4">{row.name}</td>
                          <td className="py-2 pr-4">{row.phone}</td>
                          <td className="py-2 pr-4 text-gray-500">{row.email || "—"}</td>
                          <td className="py-2 text-gray-500">{row.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-600 mt-2">All leads will be called by AI agent within 60 seconds</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button onClick={reset}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-all"
              >
                Choose Different File
              </button>
              <button onClick={handleImport} disabled={importing || preview.valid === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-40"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Import {preview.valid} Leads
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Result */}
      <AnimatePresence>
        {importResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Import Complete!</h2>
            <p className="text-gray-400 mb-6">{importResult.message}</p>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-6">
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-lg font-bold text-green-400">{importResult.imported}</div>
                <div className="text-xs text-gray-500">Imported</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-lg font-bold text-gray-400">{importResult.skipped}</div>
                <div className="text-xs text-gray-500">Skipped</div>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <div className="text-lg font-bold text-white">{importResult.total}</div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button onClick={reset}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-all"
              >
                Import Another File
              </button>
              <a href="/dashboard/leads"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 transition-all"
              >
                View Leads
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

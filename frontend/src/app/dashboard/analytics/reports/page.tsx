"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FileBarChart, Download, Calendar, Filter, Loader2, BarChart3, Table2 } from "lucide-react";

const SOURCES = ["99acres", "MagicBricks", "JustDial", "Housing", "Facebook", "Google", "Manual", "WhatsApp", "Reference"];
const STATUSES = ["PENDING", "CALLING", "BOOKED", "VISITED", "NO_SHOW", "CONVERTED", "COLD", "FOLLOWUP_D1", "FOLLOWUP_D2", "FOLLOWUP_D3"];
const GROUP_OPTIONS = [
  { value: "source", label: "By Source" },
  { value: "status", label: "By Status" },
  { value: "day", label: "By Day" },
  { value: "week", label: "By Week" },
  { value: "month", label: "By Month" },
];

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    source: [] as string[],
    status: [] as string[],
  });
  const [groupBy, setGroupBy] = useState("source");

  async function generateReport() {
    setLoading(true);
    setReport(null);
    setCsvData(null);
    try {
      const res = await api.post("/reports/generate", {
        filters: {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          source: filters.source.length > 0 ? filters.source : undefined,
          status: filters.status.length > 0 ? filters.status : undefined,
        },
        groupBy: { type: groupBy },
      });
      setReport(res.report);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  async function exportCSV() {
    try {
      const res = await api.post("/reports/export", {
        filters: {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          source: filters.source.length > 0 ? filters.source : undefined,
          status: filters.status.length > 0 ? filters.status : undefined,
        },
        groupBy: { type: groupBy },
      });
      // The API returns CSV text
      const csv = res as unknown as string;
      setCsvData(csv);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (err: any) {
      toast.error(err.message || "Failed to export");
    }
  }

  const chartColors = ["#4F6EF7", "#22D3A5", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Custom Reports</h1>
        <p className="text-gray-400 mt-1">Build custom analytics reports with filters and grouping</p>
      </div>

      {/* Filters */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-leadflow-accent" /> Report Filters
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date From</label>
            <input type="date" value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date To</label>
            <input type="date" value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Group By</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50"
            >
              {GROUP_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Source & Status multi-select */}
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Sources</label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button key={s} onClick={() => setFilters({
                  ...filters,
                  source: filters.source.includes(s)
                    ? filters.source.filter((x) => x !== s)
                    : [...filters.source, s],
                })}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs border transition-all",
                    filters.source.includes(s)
                      ? "bg-leadflow-500/20 border-leadflow-500/30 text-leadflow-accent"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Statuses</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setFilters({
                  ...filters,
                  status: filters.status.includes(s)
                    ? filters.status.filter((x) => x !== s)
                    : [...filters.status, s],
                })}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs border transition-all",
                    filters.status.includes(s)
                      ? "bg-leadflow-500/20 border-leadflow-500/30 text-leadflow-accent"
                      : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                  )}
                >
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={generateReport} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {loading ? "Generating..." : "Generate Report"}
          </button>
          {report && (
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Report Results */}
      {report && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-white/5 border border-white/10"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-leadflow-accent" /> Report Results
            </h2>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {Object.entries(report.summary || {}).map(([key, val]) => (
                <span key={key} className="capitalize">{key.replace(/([A-Z])/g, " $1")}: <strong className="text-white">{String(val)}</strong></span>
              ))}
            </div>
          </div>

          {/* Bar Chart */}
          <div className="space-y-3 mb-6">
            {report.labels?.map((label: string, i: number) => {
              const maxVal = Math.max(...(report.datasets?.[0]?.data || [1]), 1);
              const val = report.datasets?.[0]?.data?.[i] || 0;
              const secondary = report.datasets?.[1]?.data?.[i];
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{label}</span>
                    <span className="text-white font-medium">{val}{secondary != null ? ` / ${secondary}` : ""}</span>
                  </div>
                  <div className="h-6 rounded-lg bg-white/5 overflow-hidden flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(val / maxVal) * 100}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full flex items-center justify-end pr-2"
                      style={{ backgroundColor: chartColors[0] }}
                    />
                    {secondary != null && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(secondary / maxVal) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="h-full flex items-center justify-end pr-2"
                        style={{ backgroundColor: chartColors[1], opacity: 0.7 }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-gray-500 font-medium">Label</th>
                  {report.datasets?.map((ds: any) => (
                    <th key={ds.label} className="text-right py-2 px-2 text-gray-500 font-medium">{ds.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.labels?.map((label: string, i: number) => (
                  <tr key={label} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-2 text-gray-300">{label}</td>
                    {report.datasets?.map((ds: any) => (
                      <td key={ds.label} className="text-right py-2 px-2 text-white">{ds.data[i] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!report && !loading && (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <Table2 className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No report generated yet</h3>
          <p className="text-sm text-gray-500">Set your filters and click "Generate Report"</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Search, Phone, Clock, Loader2, MessageSquare,
  Filter, Calendar, BarChart3, FileText,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

interface SearchResult {
  id: string;
  leadId: string;
  lead?: { name: string; phone: string };
  type: string;
  summary?: string;
  transcript?: string;
  duration?: number;
  createdAt: string;
  highlight?: string;
}

export default function TranscriptSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleSearch = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return toast.error("Enter at least 2 characters");
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: "50" });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await api.get<{ results: SearchResult[]; total: number; stats?: any }>(`/calls/search?${params}`);
      setResults(res.results || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query, dateFrom, dateTo]);

  async function loadStats() {
    try {
      const res = await api.get("/calls/search/stats");
      setStats(res);
    } catch { /* ignore */ }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#F0F7F3]">Transcript Search</h1>
        <p className="text-[#9FB0A6] mt-1">Search across all AI call transcripts for keywords and insights</p>
      </div>

      {/* Search Bar */}
      <div className="p-6 rounded-xl app-card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9FB0A6]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleKeyDown}
              placeholder='Search transcripts — e.g., "budget", "Andheri", "ready to move"...'
              className="w-full pl-10 pr-4 py-3 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/50/50"
              autoFocus
            />
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Date filters */}
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-[#9FB0A6]" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg app-card text-[#F0F7F3] text-xs"
          />
          <span className="text-[#9FB0A6] text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg app-card text-[#F0F7F3] text-xs"
          />
          <button onClick={loadStats} className="ml-auto text-xs text-[#6FE3B0] hover:underline">Show stats</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Transcripts", value: stats.totalTranscripts || 0, icon: FileText },
            { label: "Avg. Duration", value: stats.avgDuration ? `${Math.round(stats.avgDuration / 60)}m` : "—", icon: Clock },
            { label: "Searchable Leads", value: stats.searchableLeads || 0, icon: Phone },
            { label: "Keywords Indexed", value: stats.indexedKeywords || 0, icon: BarChart3 },
          ].map((s) => (
            <div key={s.label} className="p-3 rounded-xl app-card">
              <div className="flex items-center gap-2">
                <s.icon className="w-4 h-4 text-[#9FB0A6]" />
                <span className="text-xs text-[#9FB0A6]">{s.label}</span>
              </div>
              <div className="text-lg font-bold text-[#F0F7F3] mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-[#101713] rounded-xl animate-pulse" />)}</div>
      ) : searched && results.length === 0 ? (
        <EmptyState icon={Search} title="No results found" description={`No transcripts match "${query}". Try a different search term.`} />
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-[#9FB0A6]">Found {total} result{total !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;</p>
          {results.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#34D399]/15 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-[#6FE3B0]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#F0F7F3]">{r.lead?.name || "Unknown"}</p>
                    <p className="text-xs text-[#9FB0A6]">{r.lead?.phone} • {r.type} • {formatDate(r.createdAt)}</p>
                  </div>
                </div>
                {r.duration && (
                  <span className="text-xs text-[#9FB0A6] shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {Math.round(r.duration / 60)}m
                  </span>
                )}
              </div>

              {r.summary && (
                <div className="mb-2">
                  <span className="text-xs text-[#9FB0A6] font-medium">Summary:</span>
                  <p className="text-xs text-[#9FB0A6] mt-0.5 line-clamp-2">{r.summary}</p>
                </div>
              )}

              {r.transcript && (
                <details className="group">
                  <summary className="text-xs text-[#6FE3B0] cursor-pointer hover:underline">View transcript</summary>
                  <div className="mt-2 p-3 rounded-lg bg-black/20 border border-white/10 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-[#9FB0A6] whitespace-pre-wrap font-mono leading-relaxed">{r.transcript}</pre>
                  </div>
                </details>
              )}
            </motion.div>
          ))}
        </div>
      ) : !searched ? (
        <EmptyState icon={MessageSquare} title="Search call transcripts"
          description="Enter keywords to search across all AI call transcripts. Find mentions of budgets, locations, preferences, and more."
        />
      ) : null}
    </div>
  );
}

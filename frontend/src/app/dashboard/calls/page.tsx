"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Phone, Clock } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { CallCard } from "@/components/calls/CallCard";
import { RecordingPlayer } from "@/components/calls/RecordingPlayer";
import { Pagination } from "@/components/shared/Pagination";
import { api } from "@/lib/api";
import { toast } from "sonner"
import { cn } from "@/lib/utils";
import type { Call } from "@/types";

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const limit = 50;

  const loadCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const data = await api.get(`/calls?${params.toString()}`);
      setCalls(data.calls || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error("Failed to load calls")
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const totalDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0);
  const successRate = total > 0
    ? Math.round((calls.filter((c) => c.status === "COMPLETED").length / Math.max(total, 1)) * 100)
    : 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-4">
          <p className="caption mb-1">Total Calls</p>
          <p className="text-[24px] font-display font-bold text-[#F0F0F8]">{total}</p>
        </div>
        <div className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-4">
          <p className="caption mb-1">Total Duration</p>
          <p className="text-[24px] font-display font-bold text-[#F0F0F8]">{Math.floor(totalDuration / 60)}m {totalDuration % 60}s</p>
        </div>
        <div className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-4">
          <p className="caption mb-1">Success Rate</p>
          <p className="text-[24px] font-display font-bold text-[#22D3A5]">{successRate}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B8A]" />
          <input
            type="text"
            placeholder="Search calls..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-[13px] text-[#F0F0F8] placeholder-[#3A3A52] focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7] transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {["all", "COMPLETED", "NO_ANSWER", "FAILED"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors",
                statusFilter === s
                  ? "border-[#4F6EF7] bg-[#4F6EF7]/10 text-[#4F6EF7]"
                  : "border-[#2A2A3A] text-[#6B6B8A] hover:bg-[#1A1A24]"
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Call list */}
      <div className="space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-[72px] rounded-lg bg-[#111118] border border-[#2A2A3A] animate-pulse" />
          ))
        ) : calls.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="No calls found"
            description="Calls will appear here once leads start coming in"
          />
        ) : (
          calls.map((call, i) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedCall(call)}
            >
              <CallCard call={call} />
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={limit}
          onPageChange={setPage}
          loading={loading}
        />
      )}

      {/* Recording player for selected call */}
      {selectedCall && selectedCall.recordingUrl && (
        <div className="sticky bottom-0">
          <div className="rounded-lg bg-[#1A1A24] border border-[#2A2A3A] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-medium text-[#F0F0F8]">
                Recording — {selectedCall.type}
              </span>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-[12px] text-[#6B6B8A] hover:text-[#F0F0F8] transition-colors"
              >
                Close
              </button>
            </div>
            <RecordingPlayer url={selectedCall.recordingUrl} duration={selectedCall.duration} />
          </div>
        </div>
      )}
    </div>
  );
}
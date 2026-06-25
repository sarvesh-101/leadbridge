"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Activity, AlertCircle, Clock, Loader2,
  Play, Trash2, RefreshCw, Server, Wifi, WifiOff,
  ArrowDown,
} from "lucide-react";

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: boolean;
  total: number;
  latestError: string | null;
}

export default function AdminQueuesPage() {
  const [data, setData] = useState<{
    available: boolean;
    totalJobs: number;
    activeJobs: number;
    waitingJobs: number;
    failedJobs: number;
    delayedJobs: number;
    queues: QueueStats[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadDataSilent();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function loadDataSilent() {
    try {
      const res = await api.get("/admin/queues/stats");
      setData(res);
      setLastRefresh(new Date());
    } catch {
      // Silent — don't show errors on auto-refresh
    }
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/admin/queues/stats");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load queue stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRetry(queueName: string) {
    setActionLoading(`retry-${queueName}`);
    try {
      const res = await api.post<{ message: string; retried: number }>(`/admin/queues/${queueName}/retry`);
      toast.success(res.message);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to retry");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFlush(queueName: string) {
    setActionLoading(`flush-${queueName}`);
    try {
      const res = await api.post<{ message: string; flushed: number }>(`/admin/queues/${queueName}/flush-completed`);
      toast.success(res.message);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to flush");
    } finally {
      setActionLoading(null);
    }
  }

  const totalActive = data?.activeJobs ?? 0;
  const totalWaiting = data?.waitingJobs ?? 0;
  const totalFailed = data?.failedJobs ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Queue Monitor</h1>
            <p className="text-gray-400 mt-1">BullMQ job queues and worker health</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "w-8 h-4 rounded-full transition-colors relative",
                autoRefresh ? "bg-leadflow-500" : "bg-white/10"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                autoRefresh ? "translate-x-4" : "translate-x-0.5"
              )} />
            </button>
            Auto-refresh
          </label>
          <span className="text-xs text-gray-500">
            {lastRefresh.toLocaleTimeString()}
          </span>
          <button onClick={loadData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh
          </button>
        </div>
      </div>

      {/* Redis + PostgreSQL Connection Status */}
      {!loading && data && (
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-3 rounded-xl border flex items-center gap-2",
            data.available ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20"
          )}>
            {data.available ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-yellow-400" />
            )}
            <span className={cn("text-xs font-medium", data.available ? "text-green-300" : "text-yellow-300")}>
              Redis
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className={cn("w-2 h-2 rounded-full", data.available ? "bg-green-400" : "bg-yellow-400")} />
              Queue Worker
            </span>
            <span>·</span>
            <span>Last: {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!loading && data?.available && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Jobs", value: data.totalJobs, icon: Activity, color: "from-blue-500 to-blue-600" },
            { label: "Active Now", value: totalActive, icon: Play, color: "from-amber-500 to-amber-600" },
            { label: "Waiting", value: totalWaiting, icon: Clock, color: "from-violet-500 to-violet-600" },
            { label: "Failed", value: totalFailed, icon: AlertCircle, color: "from-red-500 to-red-600" },
          ].map((card) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", card.color)}>
                <card.icon className="w-4 h-4 text-white" />
              </div>
              <div className="text-xl font-bold text-white">{card.value.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{card.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h3 className="text-lg font-medium text-white mb-2">Failed to load queue stats</h3>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Redis Unavailable */}
      {!loading && data && !data.available && (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <Server className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">Redis Disconnected</h3>
          <p className="text-sm text-gray-500">
            Queue monitoring requires Redis to be running. <br />
            Start Redis and restart the server to see queue metrics.
          </p>
        </div>
      )}

      {/* Queue Details */}
      {!loading && data?.available && data.queues && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Queue Details</h2>

          {data.queues.map((queue, i) => {
            const maxVal = Math.max(queue.waiting, queue.active, 1);
            const hasFailed = queue.failed > 0;

            return (
              <motion.div key={queue.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={cn(
                  "p-5 rounded-xl border transition-all",
                  hasFailed ? "bg-red-500/5 border-red-500/20" :
                  queue.paused ? "bg-yellow-500/5 border-yellow-500/20" :
                  "bg-white/5 border-white/10 hover:bg-white/10"
                )}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white capitalize">{queue.name}</span>
                      {queue.paused && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">PAUSED</span>
                      )}
                      {hasFailed && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                          {queue.failed} failed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {queue.total} total · {queue.completed.toLocaleString()} completed today
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasFailed && (
                      <button onClick={() => handleRetry(queue.name)}
                        disabled={actionLoading === `retry-${queue.name}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {actionLoading === `retry-${queue.name}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Retry Failed
                      </button>
                    )}
                    {queue.completed > 500 && (
                      <button onClick={() => handleFlush(queue.name)}
                        disabled={actionLoading === `flush-${queue.name}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 disabled:opacity-50"
                      >
                        {actionLoading === `flush-${queue.name}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        Flush Completed
                      </button>
                    )}
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden flex">
                  {queue.waiting > 0 && (
                    <div
                      className="h-full bg-violet-500 transition-all"
                      style={{ width: `${(queue.waiting / maxVal) * 100}%` }}
                      title={`Waiting: ${queue.waiting}`}
                    />
                  )}
                  {queue.active > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all"
                      style={{ width: `${(queue.active / maxVal) * 100}%` }}
                      title={`Active: ${queue.active}`}
                    />
                  )}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4 mt-3">
                  {[
                    { label: "Waiting", value: queue.waiting, icon: Clock, color: "text-violet-400" },
                    { label: "Active", value: queue.active, icon: Play, color: "text-amber-400" },
                    { label: "Delayed", value: queue.delayed, icon: ArrowDown, color: "text-blue-400" },
                    { label: "Failed", value: queue.failed, icon: AlertCircle, color: hasFailed ? "text-red-400" : "text-gray-500" },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center gap-1">
                        <s.icon className={cn("w-3 h-3", s.color)} />
                        <span className="text-xs text-gray-500">{s.label}</span>
                      </div>
                      <p className={cn("text-sm font-semibold mt-0.5", s.color)}>
                        {s.value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Latest Error */}
                {queue.latestError && (
                  <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-xs font-medium text-red-400 mb-1">Latest Error</p>
                    <p className="text-xs text-red-300/80 font-mono break-all">{queue.latestError}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

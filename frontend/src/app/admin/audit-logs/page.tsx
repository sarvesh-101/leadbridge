"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Search, Filter, Download, Clock, User, Shield,
  Activity, AlertCircle, CheckCircle, XCircle,
} from "lucide-react";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<any>(null);

  const pageSize = 50;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        days: "7",
      });
      if (actionFilter) params.set("action", actionFilter);
      if (resourceFilter) params.set("resourceType", resourceFilter);

      const [logsData, summaryData] = await Promise.all([
        api.get(`/admin/audit-logs?${params}`),
        api.get("/admin/audit-logs/summary"),
      ]);
      setLogs(logsData.items || []);
      setTotal(logsData.total || 0);
      setSummary(summaryData);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const totalPages = Math.ceil(total / pageSize);

  const actionLabels: Record<string, { label: string; color: string; icon: any }> = {
    login: { label: "Login", color: "text-blue-400", icon: User },
    logout: { label: "Logout", color: "text-gray-400", icon: User },
    lead_create: { label: "Lead Created", color: "text-green-400", icon: CheckCircle },
    lead_update: { label: "Lead Updated", color: "text-amber-400", icon: Activity },
    lead_delete: { label: "Lead Deleted", color: "text-red-400", icon: XCircle },
    call_initiated: { label: "Call Initiated", color: "text-violet-400", icon: Activity },
    call_completed: { label: "Call Completed", color: "text-green-400", icon: CheckCircle },
    booking_created: { label: "Booking Created", color: "text-emerald-400", icon: CheckCircle },
    booking_cancelled: { label: "Booking Cancelled", color: "text-red-400", icon: XCircle },
    payment_received: { label: "Payment Received", color: "text-green-400", icon: CheckCircle },
    payment_failed: { label: "Payment Failed", color: "text-red-400", icon: AlertCircle },
    user_created: { label: "User Created", color: "text-blue-400", icon: User },
    plan_changed: { label: "Plan Changed", color: "text-purple-400", icon: Shield },
    territory_assigned: { label: "Territory Assigned", color: "text-indigo-400", icon: Shield },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-gray-400 mt-1">Platform activity and security events</p>
        </div>
      </div>

      {/* Today's Summary */}
      {summary && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Activity className="w-4 h-4" />
            <span>Today's Activity: <span className="text-white font-medium">{summary.todayTotal}</span> events</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.actionsByType || {}).slice(0, 10).map(([action, count]) => {
              const info = actionLabels[action] || { label: action, color: "text-gray-400", icon: Activity };
              const Icon = info.icon;
              return (
                <span key={action} className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-white/5", info.color)}>
                  <Icon className="w-3 h-3" />
                  {info.label}: {count as number}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by client name, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-leadflow-500"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500"
        >
          <option value="">All Actions</option>
          {Object.keys(actionLabels).map((a) => (
            <option key={a} value={a}>{actionLabels[a].label}</option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-white/5 rounded animate-pulse w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No audit logs found for the selected filters
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => {
                  const info = actionLabels[log.action] || { label: log.action, color: "text-gray-400", icon: Activity };
                  const Icon = info.icon;
                  return (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-sm", info.color)}>
                          <Icon className="w-3.5 h-3.5" />
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{log.clientName || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">
                          {log.resourceType}{log.resourceId ? ` #${log.resourceId.slice(0, 8)}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                          log.status === "success" ? "bg-green-500/10 text-green-400" :
                          log.status === "failure" ? "bg-red-500/10 text-red-400" :
                          "bg-gray-500/10 text-gray-400"
                        )}>
                          {log.status === "success" ? <CheckCircle className="w-3 h-3" /> :
                           log.status === "failure" ? <XCircle className="w-3 h-3" /> :
                           <AlertCircle className="w-3 h-3" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{log.ipAddress || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages} ({total} total logs)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

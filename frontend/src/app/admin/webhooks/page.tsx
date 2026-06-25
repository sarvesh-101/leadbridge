"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Activity, AlertCircle, CheckCircle,
  Webhook, Globe, Mail, Search,
  Wifi, WifiOff, ShieldAlert,
} from "lucide-react";

interface WebhookSource {
  id: string;
  name: string;
  type: string;
  token: string;
  active: boolean;
  hasParserConfig: boolean;
  clientId: string;
  clientName: string | null;
  clientOwner: string | null;
  clientCity: string | null;
  createdAt: string;
}

interface WebhookEvent {
  id: string;
  clientId: string | null;
  clientName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

type Tab = "sources" | "events" | "health";

export default function AdminWebhooksPage() {
  const [activeTab, setActiveTab] = useState<Tab>("health");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Webhook Monitor</h1>
        <p className="text-gray-400 mt-1">Platform-wide webhook health and activity</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: "health" as Tab, label: "Health Overview", icon: Activity },
          { id: "sources" as Tab, label: "Sources", icon: Globe },
          { id: "events" as Tab, label: "Event Feed", icon: Webhook },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-leadflow-500/20 text-leadflow-accent border border-leadflow-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "health" && <WebhookHealthTab />}
      {activeTab === "sources" && <WebhookSourcesTab />}
      {activeTab === "events" && <WebhookEventsTab />}
    </div>
  );
}

// ─── Health Overview Tab ───────────────────────────────────────

function WebhookHealthTab() {
  const [health, setHealth] = useState<any>(null);
  const [ingestStats, setIngestStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, ingestRes] = await Promise.all([
        api.get("/admin/webhooks/health").catch(() => null),
        api.get("/admin/webhooks/ingest-stats").catch(() => null),
      ]);
      setHealth(healthRes);
      setIngestStats(ingestRes);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-gray-500" />
        <h3 className="text-lg font-medium text-white mb-2">No data available</h3>
        <p className="text-sm text-gray-500">Webhook health data will appear once events start flowing</p>
      </div>
    );
  }

  const hasIssues = health.failed > 0;

  return (
    <div className="space-y-6">
      {/* 24h Summary Card */}
      <div className={cn(
        "p-6 rounded-xl border",
        hasIssues ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20"
      )}>
        <div className="flex items-center gap-3 mb-4">
          {hasIssues ? (
            <AlertCircle className="w-6 h-6 text-red-400" />
          ) : (
            <CheckCircle className="w-6 h-6 text-green-400" />
          )}
          <div>
            <p className="text-sm font-medium text-white">
              {hasIssues ? "Some webhooks are failing" : "All webhooks healthy"}
            </p>
            <p className="text-xs text-gray-500">Last 24 hours</p>
          </div>
          <span className={cn(
            "ml-auto text-2xl font-bold",
            hasIssues ? "text-red-400" : "text-green-400"
          )}>
            {health.successRate}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Events", value: health.total, color: "text-blue-400" },
            { label: "Successful", value: health.success, color: "text-green-400" },
            { label: "Failed", value: health.failed, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label}>
              <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Per-endpoint breakdown */}
        {health.byEndpoint && Object.keys(health.byEndpoint).length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-xs font-medium text-gray-400 mb-3">Per Endpoint</p>
            <div className="space-y-2">
              {Object.entries(health.byEndpoint).map(([endpoint, stats]: [string, any]) => {
                const failRate = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0;
                return (
                  <div key={endpoint} className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 w-36 truncate">{endpoint}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", failRate > 0 ? "bg-red-500" : "bg-green-500")}
                        style={{ width: `${failRate > 0 ? 100 - failRate : 100}%` }}
                      />
                    </div>
                    <span className={cn("text-xs w-16 text-right", stats.failed > 0 ? "text-red-400" : "text-green-400")}>
                      {stats.total - stats.failed}/{stats.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ingest Source Performance */}
      {ingestStats?.bySource && Object.keys(ingestStats.bySource).length > 0 && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h2 className="text-sm font-semibold text-white mb-4">Ingest Performance (30 days)</h2>
          <div className="space-y-3">
            {Object.entries(ingestStats.bySource).map(([source, stats]: [string, any]) => {
              const bookRate = stats.total > 0 ? Math.round((stats.booked / stats.total) * 100) : 0;
              return (
                <div key={source} className="flex items-center gap-4 p-3 rounded-lg bg-white/5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-leadflow-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{source}</p>
                    <p className="text-xs text-gray-500">{stats.total} leads · {bookRate}% booked</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400">{stats.booked} booked</span>
                    <span className="text-gray-500">·</span>
                    <span className="text-red-400">{stats.failed} failed</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sources Tab ───────────────────────────────────────────────

function WebhookSourcesTab() {
  const [sources, setSources] = useState<WebhookSource[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        totalSources: number;
        activeSources: number;
        sources: WebhookSource[];
      }>("/admin/webhooks/sources");
      setSources(res.sources);
      setTotal(res.totalSources);
      setActiveCount(res.activeSources);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = sources.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
           s.clientName?.toLowerCase().includes(q) ||
           s.type.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Sources", value: total, icon: Globe, color: "from-blue-500 to-blue-600" },
          { label: "Active", value: activeCount, icon: Wifi, color: "from-green-500 to-green-600" },
          { label: "Inactive", value: total - activeCount, icon: WifiOff, color: "from-gray-500 to-gray-600" },
          { label: "Clients", value: new Set(sources.map(s => s.clientId)).size, icon: Activity, color: "from-violet-500 to-violet-600" },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            {loading ? (
              <div className="animate-pulse"><div className="h-8 w-12 bg-white/10 rounded" /></div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", card.color)}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-white">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, client, or type..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <Globe className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No webhook sources found</h3>
          <p className="text-sm text-gray-500">{search ? "Try a different search" : "No webhook sources configured yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((source, i) => (
            <motion.div key={source.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center shrink-0">
                {source.type === "email" ? (
                  <Mail className="w-5 h-5 text-blue-400" />
                ) : (
                  <Webhook className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">{source.name}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    source.active ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"
                  )}>
                    {source.active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-gray-500">{source.type}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {source.clientName || "Unknown client"} · {source.clientCity || ""} · Token: {source.token.slice(0, 8)}...
                </p>
              </div>
              {source.hasParserConfig && (
                <span className="text-xs text-leadflow-accent">Custom parser</span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Events Feed Tab ───────────────────────────────────────────

function WebhookEventsTab() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await api.get<{
        items: WebhookEvent[];
        total: number;
        totalPages: number;
      }>(`/admin/webhooks/events?${params}`);
      setEvents(res.items);
      setTotal(res.total);
    } catch {} finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failure">Failed</option>
        </select>
        <span className="text-xs text-gray-500">{total} total events</span>
      </div>

      {/* Events */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <Webhook className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No events found</h3>
          <p className="text-sm text-gray-500">Webhook events will appear here as they are received</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-sm"
            >
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0",
                event.status === "failure" ? "bg-red-400" : "bg-green-400"
              )} />
              <span className="text-gray-300 w-40 truncate">{event.action}</span>
              <span className="text-gray-500 flex-1 truncate">
                {event.clientName ? `${event.clientName} · ` : ""}
                {event.errorMessage || event.resourceType || "—"}
              </span>
              <span className="text-gray-500 text-xs shrink-0">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-400 disabled:opacity-50 hover:bg-white/10"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-400 disabled:opacity-50 hover:bg-white/10"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

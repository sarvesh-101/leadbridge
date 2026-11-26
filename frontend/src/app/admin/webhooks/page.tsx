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
        <h1 className="text-2xl font-bold text-ink">Webhook Monitor</h1>
        <p className="text-ink-soft mt-1">Platform-wide webhook health and activity</p>
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
                ? "bg-brand/25 text-brand-deep border border-brand/40"
                : "bg-canvas text-ink-soft border border-line hover:bg-white/[0.06]"
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
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl app-card animate-pulse" />)}
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-center py-16 rounded-xl app-card">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-ink-soft" />
        <h3 className="text-lg font-medium text-ink mb-2">No data available</h3>
        <p className="text-sm text-ink-soft">Webhook health data will appear once events start flowing</p>
      </div>
    );
  }

  const hasIssues = health.failed > 0;

  return (
    <div className="space-y-6">
      {/* 24h Summary Card */}
      <div className={cn(
        "p-6 rounded-xl border",
        hasIssues ? "bg-danger/5 border-danger/20" : "bg-success/5 border-success/20"
      )}>
        <div className="flex items-center gap-3 mb-4">
          {hasIssues ? (
            <AlertCircle className="w-6 h-6 text-danger" />
          ) : (
            <CheckCircle className="w-6 h-6 text-success" />
          )}
          <div>
            <p className="text-sm font-medium text-ink">
              {hasIssues ? "Some webhooks are failing" : "All webhooks healthy"}
            </p>
            <p className="text-xs text-ink-soft">Last 24 hours</p>
          </div>
          <span className={cn(
            "ml-auto text-2xl font-bold",
            hasIssues ? "text-danger" : "text-success"
          )}>
            {health.successRate}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Events", value: health.total, color: "text-blue-400" },
            { label: "Successful", value: health.success, color: "text-success" },
            { label: "Failed", value: health.failed, color: "text-danger" },
          ].map((s) => (
            <div key={s.label}>
              <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-ink-soft">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Per-endpoint breakdown */}
        {health.byEndpoint && Object.keys(health.byEndpoint).length > 0 && (
          <div className="mt-5 pt-4 border-t border-line">
            <p className="text-xs font-medium text-ink-soft mb-3">Per Endpoint</p>
            <div className="space-y-2">
              {Object.entries(health.byEndpoint).map(([endpoint, stats]: [string, any]) => {
                const failRate = stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0;
                return (
                  <div key={endpoint} className="flex items-center gap-3">
                    <span className="text-xs text-ink-soft w-36 truncate">{endpoint}</span>
                    <div className="flex-1 h-2 rounded-full bg-canvas overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", failRate > 0 ? "bg-danger" : "bg-success")}
                        style={{ width: `${failRate > 0 ? 100 - failRate : 100}%` }}
                      />
                    </div>
                    <span className={cn("text-xs w-16 text-right", stats.failed > 0 ? "text-danger" : "text-success")}>
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
        <div className="p-6 rounded-xl app-card">
          <h2 className="text-sm font-semibold text-ink mb-4">Ingest Performance (30 days)</h2>
          <div className="space-y-3">
            {Object.entries(ingestStats.bySource).map(([source, stats]: [string, any]) => {
              const bookRate = stats.total > 0 ? Math.round((stats.booked / stats.total) * 100) : 0;
              return (
                <div key={source} className="flex items-center gap-4 p-3 rounded-lg bg-canvas">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-line-subtle/20 to-brand-deep/20 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-brand-deep" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{source}</p>
                    <p className="text-xs text-ink-soft">{stats.total} leads · {bookRate}% booked</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-success">{stats.booked} booked</span>
                    <span className="text-ink-soft">·</span>
                    <span className="text-danger">{stats.failed} failed</span>
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
          { label: "Active", value: activeCount, icon: Wifi, color: "from-success to-success" },
          { label: "Inactive", value: total - activeCount, icon: WifiOff, color: "from-gray-500 to-gray-600" },
          { label: "Clients", value: new Set(sources.map(s => s.clientId)).size, icon: Activity, color: "from-violet-500 to-violet-600" },
        ].map((card) => (
          <div key={card.label} className="p-4 rounded-xl app-card">
            {loading ? (
              <div className="animate-pulse"><div className="h-8 w-12 bg-white/[0.06] rounded" /></div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", card.color)}>
                  <card.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-ink">{card.value}</div>
                <div className="text-xs text-ink-soft">{card.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, client, or type..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/60"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl app-card animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl app-card">
          <Globe className="w-12 h-12 mx-auto mb-4 text-ink-soft" />
          <h3 className="text-lg font-medium text-ink mb-2">No webhook sources found</h3>
          <p className="text-sm text-ink-soft">{search ? "Try a different search" : "No webhook sources configured yet"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((source, i) => (
            <motion.div key={source.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] transition-all"
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
                  <span className="text-sm font-medium text-ink">{source.name}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    source.active ? "bg-success/10 text-success" : "bg-neutral-soft/10 text-ink-soft"
                  )}>
                    {source.active ? "Active" : "Inactive"}
                  </span>
                  <span className="text-xs text-ink-soft">{source.type}</span>
                </div>
                <p className="text-xs text-ink-soft mt-1">
                  {source.clientName || "Unknown client"} · {source.clientCity || ""} · Token: {source.token.slice(0, 8)}...
                </p>
              </div>
              {source.hasParserConfig && (                  <span className="text-xs text-brand-deep">Custom parser</span>
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
          className="px-4 py-2.5 rounded-xl app-card text-ink-soft text-sm"
        >
          <option value="all">All Status</option>
          <option value="success">Success</option>
          <option value="failure">Failed</option>
        </select>
        <span className="text-xs text-ink-soft">{total} total events</span>
      </div>

      {/* Events */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-14 rounded-xl app-card animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 rounded-xl app-card">
          <Webhook className="w-12 h-12 mx-auto mb-4 text-ink-soft" />
          <h3 className="text-lg font-medium text-ink mb-2">No events found</h3>
          <p className="text-sm text-ink-soft">Webhook events will appear here as they are received</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id}
              className="flex items-center gap-3 p-3 rounded-xl app-card text-sm"
            >
              <span className={cn(
                "w-2 h-2 rounded-full shrink-0",
                event.status === "failure" ? "bg-danger" : "bg-success"
              )} />
              <span className="text-ink-soft w-40 truncate">{event.action}</span>
              <span className="text-ink-soft flex-1 truncate">
                {event.clientName ? `${event.clientName} · ` : ""}
                {event.errorMessage || event.resourceType || "—"}
              </span>
              <span className="text-ink-soft text-xs shrink-0">
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
            className="px-3 py-1.5 text-sm rounded-lg app-card app-card-hover text-ink-soft disabled:opacity-50 hover:bg-white/[0.06]"
          >
            Previous
          </button>
          <span className="text-sm text-ink-soft">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg app-card app-card-hover text-ink-soft disabled:opacity-50 hover:bg-white/[0.06]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

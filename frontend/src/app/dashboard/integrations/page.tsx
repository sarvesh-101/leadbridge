"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Link as LinkIcon, Plus, Check, X, Loader2, ExternalLink, RefreshCw,
  Trash2, Zap, AlertCircle, Wifi, WifiOff,
} from "lucide-react";

const PROVIDER_ICONS: Record<string, string> = {
  indiamart: "🏭", justdial: "📞", magicbricks: "🔮",
  housing: "🏠", "99acres": "🏗️", facebook: "📘",
  google: "🔍", zoho: "📊", zapier: "⚡",
};

interface ProviderInfo {
  slug: string;
  name: string;
  description: string;
  docsUrl: string;
  type: string;
  setupSteps: string[];
}

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  description?: string;
  status: string;
  type: string;
  syncFrequency?: string;
  lastSyncAt?: string;
  totalSynced: number;
  totalErrors: number;
  lastErrorMessage?: string;
  lastErrorAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Connect modal
  const [showConnect, setShowConnect] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [providersRes, integrationsRes, healthRes] = await Promise.all([
        api.get<{ providers: ProviderInfo[] }>("/integrations/providers"),
        api.get<{ items: IntegrationItem[] }>("/integrations"),
        api.get("/integrations/health").catch(() => null),
      ]);
      setProviders(providersRes.providers);
      setIntegrations(integrationsRes.items);
      setHealth(healthRes);
    } catch (err: any) {
      console.error("Failed to load integrations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleConnect() {
    if (!selectedProvider) return;
    setActionLoading("connect");
    try {
      const res = await api.post<{ id: string; status: string }>("/integrations", {
        provider: selectedProvider.slug,
        apiKey: apiKey || undefined,
        apiSecret: apiSecret || undefined,
      });
      setShowConnect(false);
      setApiKey("");
      setApiSecret("");
      setSelectedProvider(null);
      toast.success(`Connected to ${selectedProvider.name}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleTest(integrationId: string) {
    setActionLoading(`test-${integrationId}`);
    try {
      await api.post(`/integrations/${integrationId}/test`);
      toast.success("Integration tested successfully!");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSync(integrationId: string) {
    setActionLoading(`sync-${integrationId}`);
    try {
      await api.post(`/integrations/${integrationId}/sync`);
      toast.success("Sync triggered");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(integrationId: string) {
    setActionLoading(`delete-${integrationId}`);
    try {
      await api.delete(`/integrations/${integrationId}`);
      toast.success("Integration removed");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setActionLoading(null);
    }
  }

  const activeIntegrations = integrations.filter(i => i.status === "ACTIVE");
  const errorIntegrations = integrations.filter(i => i.status === "ERROR");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="text-gray-400 mt-1">Connect your lead sources and tools</p>
        </div>
      </div>

      {/* Health Overview */}
      {!loading && health && (
        <div className={cn(
          "p-4 rounded-xl border flex items-center gap-3",
          health.overallStatus === "healthy"
            ? "bg-green-500/10 border-green-500/20"
            : health.overallStatus === "degraded"
            ? "bg-yellow-500/10 border-yellow-500/20"
            : "bg-red-500/10 border-red-500/20"
        )}>
          {health.overallStatus === "healthy" ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-yellow-400" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-white capitalize">{health.overallStatus}</p>
            <p className="text-xs text-gray-400">
              {health.active} active · {health.error} errors · {health.totalSynced} total synced
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: LinkIcon, label: "Connected", value: loading ? "—" : activeIntegrations.length, color: "from-green-500 to-green-600" },
          { icon: Zap, label: "Total", value: loading ? "—" : integrations.length, color: "from-blue-500 to-blue-600" },
          { icon: RefreshCw, label: "Synced", value: loading ? "—" : health?.totalSynced ?? 0, color: "from-purple-500 to-purple-600" },
          { icon: AlertCircle, label: "Errors", value: loading ? "—" : errorIntegrations.length, color: "from-orange-500 to-orange-600" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            {loading ? (
              <div className="animate-pulse"><div className="h-8 w-12 bg-white/10 rounded" /></div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Connected Integrations */}
      {!loading && integrations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Connected Integrations</h2>
          {integrations.map((int, i) => (
            <motion.div key={int.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  int.status === "ACTIVE" ? "bg-green-500/20" :
                  int.status === "ERROR" ? "bg-red-500/20" : "bg-gray-500/20"
                )}>
                  {int.status === "ACTIVE" ? <Wifi className="w-5 h-5 text-green-400" /> :
                   int.status === "ERROR" ? <WifiOff className="w-5 h-5 text-red-400" /> :
                   <LinkIcon className="w-5 h-5 text-gray-400" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{int.name}</span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      int.status === "ACTIVE" ? "bg-green-500/10 text-green-400" :
                      int.status === "ERROR" ? "bg-red-500/10 text-red-400" :
                      "bg-gray-500/10 text-gray-400"
                    )}>{int.status}</span>
                    <span className="text-xs text-gray-500 capitalize">{int.type?.replace(/_/g, " ")}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {int.totalSynced} synced · {int.totalErrors} errors
                    {int.lastSyncAt && ` · Last sync: ${new Date(int.lastSyncAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleTest(int.id)} disabled={actionLoading === `test-${int.id}`}
                  className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                  title="Test connection"
                >
                  {actionLoading === `test-${int.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                </button>
                <button onClick={() => handleSync(int.id)} disabled={actionLoading === `sync-${int.id}`}
                  className="p-2 rounded-lg border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
                  title="Sync now"
                >
                  {actionLoading === `sync-${int.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(int.id)} disabled={actionLoading === `delete-${int.id}`}
                  className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  title="Remove"
                >
                  {actionLoading === `delete-${int.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Available Providers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Available Integrations</h2>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-28 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {providers.map((provider) => {
              const isConnected = integrations.some(i => i.provider === provider.slug);
              return (
                <motion.div key={provider.slug}
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    isConnected
                      ? "bg-green-500/5 border-green-500/20"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{PROVIDER_ICONS[provider.slug] || "🔌"}</span>
                      <h3 className="text-sm font-medium text-white">{provider.name}</h3>
                    </div>
                    {isConnected && <Check className="w-4 h-4 text-green-400" />}
                  </div>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{provider.description}</p>
                  <div className="flex items-center justify-between">
                    <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-leadflow-accent hover:underline inline-flex items-center gap-1"
                    >
                      Docs <ExternalLink className="w-3 h-3" />
                    </a>
                    {!isConnected ? (
                      <button onClick={() => {
                        setSelectedProvider(provider);
                        setApiKey("");
                        setApiSecret("");
                        setShowConnect(true);
                      }}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-xs font-medium hover:opacity-90"
                      >
                        Connect
                      </button>
                    ) : (
                      <span className="text-xs text-green-400">Connected</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      <AnimatePresence>
        {showConnect && selectedProvider && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">Connect {selectedProvider.name}</h2>
                </div>
                <button onClick={() => setShowConnect(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Setup Steps */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-white mb-3">Setup Instructions</h3>
                <ol className="space-y-2">
                  {selectedProvider.setupSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="w-5 h-5 rounded-full bg-white/5 text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <a href={selectedProvider.docsUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-leadflow-accent hover:underline mt-3"
                >
                  Open {selectedProvider.name} <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">API Key</label>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`${selectedProvider.name} API key`}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">API Secret (optional)</label>
                  <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="API secret / token"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowConnect(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                >
                  Cancel
                </button>
                <button onClick={handleConnect} disabled={actionLoading === "connect"}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading === "connect" ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</> : "Connect"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

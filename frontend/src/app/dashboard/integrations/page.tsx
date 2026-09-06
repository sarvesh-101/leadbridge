"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Link as LinkIcon, X, Loader2, ExternalLink, RefreshCw,
  Trash2, Zap, AlertCircle, Wifi, WifiOff, Copy, CheckCircle2, Smartphone, Mail,
} from "lucide-react";

interface ProviderInfo {
  slug: string;
  name: string;
  description: string;
  docsUrl: string;
  type: string;
  kind: "api" | "forwarding" | "sync";
  setupSteps: string[];
}

interface IntegrationItem {
  id: string;
  provider: string;
  name: string;
  description?: string;
  status: string;
  kind: string;
  type: string;
  syncFrequency?: string;
  lastSyncAt?: string;
  totalSynced: number;
  totalErrors: number;
  lastErrorMessage?: string;
  lastErrorAt?: string;
  createdAt: string;
  updatedAt: string;
  webhookUrl?: string | null;
}

const PROVIDER_ICONS: Record<string, string> = {
  indiamart: "🏭", justdial: "📞", magicbricks: "🔮", housing: "🏠", "99acres": "🏗️",
};

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // IndiaMART connect modal
  const [showConnect, setShowConnect] = useState(false);
  const [crmKey, setCrmKey] = useState("");
  const [mobile, setMobile] = useState("");

  // Facebook connect
  const [showFbConnect, setShowFbConnect] = useState(false);
  const [fbToken, setFbToken] = useState("");
  const [fbOauthLoading, setFbOauthLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [providersRes, integrationsRes] = await Promise.all([
        api.get<{ providers: ProviderInfo[] }>("/integrations/providers"),
        api.get<{ items: IntegrationItem[] }>("/integrations"),
      ]);
      setProviders(providersRes.providers);
      setIntegrations(integrationsRes.items);
    } catch (err: any) {
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle the Meta OAuth redirect (?fb_oauth=1&code=...) back to this page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fb_oauth") === "1" && params.get("code")) {
      const code = params.get("code")!;
      window.history.replaceState({}, document.title, window.location.pathname);
      setFbOauthLoading(true);
      api
        .post<{ message: string }>("/integrations/facebook/exchange", { code })
        .then((res) => {
          toast.success(res.message || "Facebook connected!");
          setShowFbConnect(false);
          loadData();
        })
        .catch((err: any) => toast.error(err.message || "Facebook connection failed"))
        .finally(() => setFbOauthLoading(false));
    }
  }, [loadData]);

  const indiamartIntegration = integrations.find(i => i.provider === "indiamart");

  async function handleConnectIndiaMart() {
    if (!crmKey.trim()) return toast.error("CRM key is required");
    if (!mobile.trim() || mobile.replace(/\D/g, "").length !== 10) {
      return toast.error("Enter the 10-digit mobile number registered on IndiaMART");
    }
    setActionLoading("connect");
    try {
      const res = await api.post<{ id: string; status: string }>("/integrations", {
        provider: "indiamart",
        apiKey: crmKey.trim(),
        settings: { mobile: mobile.trim() },
      });
      setShowConnect(false);
      setCrmKey("");
      setMobile("");
      toast.success("IndiaMART credentials saved!");
      await loadData();
      // Verify the credentials immediately so the broker knows they work.
      const testRes = await api.post<{ status: string; message: string }>(`/integrations/${res.id}/test`).catch((e: any) => null);
      if (testRes) {
        toast.success(testRes.message || "IndiaMART connection verified");
      }
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
      const res = await api.post<{ message: string; leadsInWindow?: number }>(`/integrations/${integrationId}/test`);
      toast.success(res.message || "Integration tested successfully!");
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
      const res = await api.post<{ message: string }>(`/integrations/${integrationId}/sync`);
      toast.success(res.message || "Sync triggered");
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

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied!")).catch(() => toast.error("Failed to copy"));
  }

  const facebookIntegration = integrations.find(i => i.provider === "facebook");

  async function handleConnectFacebook() {
    if (!fbToken.trim()) return toast.error("Page Access Token is required");
    setActionLoading("fb-connect");
    try {
      const res = await api.post<{ message: string }>("/integrations/facebook/connect", {
        pageAccessToken: fbToken.trim(),
      });
      setShowFbConnect(false);
      setFbToken("");
      toast.success(res.message || "Facebook connected!");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFbOauth() {
    setFbOauthLoading(true);
    try {
      const res = await api.get<{ url: string }>("/integrations/facebook/oauth-url");
      window.location.href = res.url;
    } catch (err: any) {
      toast.error(err.message || "Facebook OAuth isn't configured on this platform — paste a Page Access Token instead");
      setFbOauthLoading(false);
    }
  }

  const apiProviders = providers.filter(p => p.kind === "api");
  const forwardingProviders = providers.filter(p => p.kind === "forwarding");
  const activeIntegrations = integrations.filter(i => i.status === "ACTIVE");
  const errorIntegrations = integrations.filter(i => i.status === "ERROR");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F7F3]">Integrations</h1>
          <p className="text-[#9FB0A6] mt-1">Connect your lead sources — every lead that arrives gets AI-called automatically</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { icon: LinkIcon, label: "Connected", value: loading ? "—" : activeIntegrations.length, color: "from-green-500 to-green-600" },
          { icon: Zap, label: "Total", value: loading ? "—" : integrations.length, color: "from-blue-500 to-blue-600" },
          { icon: AlertCircle, label: "Errors", value: loading ? "—" : errorIntegrations.length, color: "from-orange-500 to-orange-600" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl app-card">
            {loading ? (
              <div className="animate-pulse"><div className="h-8 w-12 bg-white/[0.06] rounded" /></div>
            ) : (
              <>
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-[#F0F7F3]">{s.value}</div>
                <div className="text-xs text-[#9FB0A6]">{s.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* ─── IndiaMART — Real API connector ─────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#F0F7F3]">Real-time API Integration</h2>

        {loading ? (
          <div className="h-32 rounded-xl app-card animate-pulse" />
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-5 rounded-xl border transition-all",
              indiamartIntegration?.status === "ACTIVE"
                ? "bg-green-500/5 border-green-500/20"
                : indiamartIntegration?.status === "ERROR"
                ? "bg-red-500/5 border-red-500/20"
                : "bg-[#101713] border-white/10"
            )}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#34D399]/15 flex items-center justify-center text-xl shrink-0">🏭</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#F0F7F3]">IndiaMART</h3>
                    {indiamartIntegration && (
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        indiamartIntegration.status === "ACTIVE" ? "bg-green-500/10 text-green-400" :
                        indiamartIntegration.status === "ERROR" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-[#9FB0A6]"
                      )}>{indiamartIntegration.status}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#9FB0A6] mt-0.5">
                    Official IndiaMART Leads API — leads are pushed here in real-time and the AI calls them automatically.
                  </p>
                  {indiamartIntegration?.lastErrorMessage && (
                    <p className="text-xs text-red-400 mt-1">{indiamartIntegration.lastErrorMessage}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {indiamartIntegration ? (
                  <>
                    <button onClick={() => handleTest(indiamartIntegration.id)} disabled={actionLoading === `test-${indiamartIntegration.id}`}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {actionLoading === `test-${indiamartIntegration.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Test
                    </button>
                    <button onClick={() => handleSync(indiamartIntegration.id)} disabled={actionLoading === `sync-${indiamartIntegration.id}`}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {actionLoading === `sync-${indiamartIntegration.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync now
                    </button>
                    <button onClick={() => handleDelete(indiamartIntegration.id)} disabled={actionLoading === `delete-${indiamartIntegration.id}`}
                      className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      title="Disconnect"
                    >
                      {actionLoading === `delete-${indiamartIntegration.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowConnect(true)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-xs font-medium hover:opacity-90"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Connected status details */}
            {indiamartIntegration && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-black/20 border border-white/10">
                  <p className="text-[11px] text-[#9FB0A6] mb-1.5 flex items-center gap-1.5">
                    <Wifi className="w-3 h-3 text-[#6FE3B0]" /> Push API webhook URL
                  </p>
                  {indiamartIntegration.webhookUrl ? (
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] text-[#F0F7F3] font-mono break-all flex-1">{indiamartIntegration.webhookUrl}</code>
                      <button onClick={() => copyText(indiamartIntegration.webhookUrl!)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6] shrink-0" title="Copy">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#9FB0A6]">Set WEBHOOK_URL in your environment to generate.</p>
                  )}
                  <p className="text-[10px] text-[#6B7C73] mt-1.5">
                    Paste this into IndiaMART: Lead Manager → ⋮ → Import/Export Leads → Push API → "Other" CRM → verify with OTP.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-black/20 border border-white/10">
                  <p className="text-[11px] text-[#9FB0A6] mb-1.5">Sync status</p>
                  <div className="space-y-1 text-[11px] text-[#F0F7F3]">
                    <p>{indiamartIntegration.totalSynced} leads imported</p>
                    <p>{indiamartIntegration.totalErrors} errors</p>
                    {indiamartIntegration.lastSyncAt
                      ? <p className="text-[#9FB0A6]">Last sync: {new Date(indiamartIntegration.lastSyncAt).toLocaleString()}</p>
                      : <p className="text-[#9FB0A6]">Auto-syncs every 5 minutes (Pull API)</p>}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Facebook Lead Ads — Real API connector ─────────────── */}
        {loading ? (
          <div className="h-32 rounded-xl app-card animate-pulse" />
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className={cn(
              "p-5 rounded-xl border transition-all",
              facebookIntegration?.status === "ACTIVE"
                ? "bg-green-500/5 border-green-500/20"
                : facebookIntegration?.status === "ERROR"
                ? "bg-red-500/5 border-red-500/20"
                : "bg-[#101713] border-white/10"
            )}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#1877F2]/15 flex items-center justify-center text-xl shrink-0">📘</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#F0F7F3]">Facebook Lead Ads</h3>
                    {facebookIntegration && (
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded",
                        facebookIntegration.status === "ACTIVE" ? "bg-green-500/10 text-green-400" :
                        facebookIntegration.status === "ERROR" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-[#9FB0A6]"
                      )}>{facebookIntegration.status}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#9FB0A6] mt-0.5">
                    Official Meta leadgen webhook — every lead form submission is AI-called automatically.
                  </p>
                  {facebookIntegration?.lastErrorMessage && (
                    <p className="text-xs text-red-400 mt-1">{facebookIntegration.lastErrorMessage}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {facebookIntegration ? (
                  <>
                    <button onClick={() => handleTest(facebookIntegration.id)} disabled={actionLoading === `test-${facebookIntegration.id}`}
                      className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {actionLoading === `test-${facebookIntegration.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Test
                    </button>
                    <button onClick={() => handleDelete(facebookIntegration.id)} disabled={actionLoading === `delete-${facebookIntegration.id}`}
                      className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      title="Disconnect"
                    >
                      {actionLoading === `delete-${facebookIntegration.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowFbConnect(true)} disabled={fbOauthLoading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#1877F2] to-[#0E4FA1] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {fbOauthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                  </button>
                )}
              </div>
            </div>

            {facebookIntegration && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-black/20 border border-white/10">
                  <p className="text-[11px] text-[#9FB0A6] mb-1.5 flex items-center gap-1.5">
                    <Wifi className="w-3 h-3 text-[#6FE3B0]" /> Webhook URL (configured on the Meta app)
                  </p>
                  {facebookIntegration.webhookUrl ? (
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] text-[#F0F7F3] font-mono break-all flex-1">{facebookIntegration.webhookUrl}</code>
                      <button onClick={() => copyText(facebookIntegration.webhookUrl!)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6] shrink-0" title="Copy">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#9FB0A6]">Set WEBHOOK_URL in your environment to generate.</p>
                  )}
                  <p className="text-[10px] text-[#6B7C73] mt-1.5">
                    {facebookIntegration.name} · Lead Ads page webhook subscribed.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-black/20 border border-white/10">
                  <p className="text-[11px] text-[#9FB0A6] mb-1.5">Sync status</p>
                  <div className="space-y-1 text-[11px] text-[#F0F7F3]">
                    <p>{facebookIntegration.totalSynced} leads imported</p>
                    <p>{facebookIntegration.totalErrors} errors</p>
                    <p className="text-[#9FB0A6]">Delivered in real-time by Meta — no polling needed</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ─── Portal forwarding (JustDial, 99acres, etc.) ────────── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[#F0F7F3]">Portal SMS & Email Forwarding</h2>
          <p className="text-xs text-[#9FB0A6] mt-0.5">
            These portals don't offer a lead API — you forward their enquiry SMS/email to Converza and the AI calls the lead.
          </p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-xl app-card animate-pulse" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forwardingProviders.map((provider) => (
              <motion.div key={provider.slug}
                className="p-4 rounded-xl border bg-[#101713] border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{PROVIDER_ICONS[provider.slug] || "🔌"}</span>
                    <h3 className="text-sm font-medium text-[#F0F7F3]">{provider.name}</h3>
                  </div>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#E8C468]/10 border border-[#E8C468]/25">
                    <Smartphone className="w-3 h-3 text-[#E8C468]" />
                    <span className="text-[9px] font-medium text-[#E8C468]">Forwarding</span>
                  </span>
                </div>
                <p className="text-xs text-[#9FB0A6] mb-3 line-clamp-2">{provider.description}</p>
                <div className="flex items-center justify-between">
                  <a href="/dashboard/forwarding"
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-xs font-medium hover:opacity-90 inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3 h-3" /> Set up forwarding
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Connected Integrations (rows) ──────────────────────── */}
      {!loading && integrations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#F0F7F3]">All Connections</h2>
          {integrations.map((int) => (
            <motion.div key={int.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-4 rounded-xl app-card app-card-hover hover:bg-white/[0.06] transition-all"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  int.status === "ACTIVE" ? "bg-green-500/20" :
                  int.status === "ERROR" ? "bg-red-500/20" : "bg-gray-500/20"
                )}>
                  {int.status === "ACTIVE" ? <Wifi className="w-5 h-5 text-green-400" /> :
                   int.status === "ERROR" ? <WifiOff className="w-5 h-5 text-red-400" /> :
                   <LinkIcon className="w-5 h-5 text-[#9FB0A6]" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#F0F7F3]">{int.name}</span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      int.status === "ACTIVE" ? "bg-green-500/10 text-green-400" :
                      int.status === "ERROR" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-[#9FB0A6]"
                    )}>{int.status}</span>
                  </div>
                  <p className="text-xs text-[#9FB0A6] mt-0.5">
                    {int.totalSynced} synced · {int.totalErrors} errors
                    {int.lastSyncAt && ` · Last sync: ${new Date(int.lastSyncAt).toLocaleDateString()}`}
                    {int.lastErrorMessage && <span className="text-red-400"> · {int.lastErrorMessage}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {int.kind === "api" && (
                  <>
                    <button onClick={() => handleTest(int.id)} disabled={actionLoading === `test-${int.id}`}
                      className="p-2 rounded-lg border border-white/10 text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] disabled:opacity-50"
                      title="Test connection"
                    >
                      {actionLoading === `test-${int.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    </button>
                    {int.provider === "indiamart" && (
                      <button onClick={() => handleSync(int.id)} disabled={actionLoading === `sync-${int.id}`}
                        className="p-2 rounded-lg border border-white/10 text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] disabled:opacity-50"
                        title="Sync now"
                      >
                        {actionLoading === `sync-${int.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    )}
                  </>
                )}
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

      {/* ─── IndiaMART Connect Modal ────────────────────────────── */}
      <AnimatePresence>
        {showConnect && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl app-card max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏭</span>
                  <h2 className="text-lg font-semibold text-[#F0F7F3]">Connect IndiaMART</h2>
                </div>
                <button onClick={() => setShowConnect(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Setup instructions */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-[#F0F7F3] mb-3">Get your CRM key (2 minutes)</h3>
                <ol className="space-y-2">
                  {[
                    "Log in to seller.indiamart.com with your IndiaMART account",
                    "Go to Lead Manager → (⋮ three-dot menu) → CRM Integration → Generate Key",
                    "The CRM key is sent to your registered email — copy it",
                    "Note: the Leads API is a paid IndiaMART add-on — if the key page doesn't load, contact your IndiaMART account manager to enable it",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#9FB0A6]">
                      <span className="w-5 h-5 rounded-full bg-[#101713] text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <a href="https://seller.indiamart.com/leadmanager/crmapi" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#2D6A4F] hover:underline mt-3"
                >
                  Open IndiaMART key page <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#9FB0A6] mb-1.5">Registered mobile number (10 digits) *</label>
                  <input value={mobile} onChange={(e) => setMobile(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#9FB0A6] mb-1.5">IndiaMART CRM key *</label>
                  <input value={crmKey} onChange={(e) => setCrmKey(e.target.value)}
                    placeholder="Paste the CRM key from your email"
                    className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowConnect(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-[#9FB0A6] text-sm font-medium hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
                <button onClick={handleConnectIndiaMart} disabled={actionLoading === "connect"}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading === "connect" ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</> : <><CheckCircle2 className="w-4 h-4" /> Save & Verify</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Facebook Connect Modal ─────────────────────────────── */}
      <AnimatePresence>
        {showFbConnect && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl app-card max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📘</span>
                  <h2 className="text-lg font-semibold text-[#F0F7F3]">Connect Facebook Lead Ads</h2>
                </div>
                <button onClick={() => setShowFbConnect(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Option 1 — OAuth */}
              <div className="mb-4 p-4 rounded-xl bg-black/20 border border-white/10">
                <h3 className="text-sm font-medium text-[#F0F7F3] mb-2">Option 1 — Connect with Facebook</h3>
                <p className="text-xs text-[#9FB0A6] mb-3">
                  Authorize your Facebook Page in Meta's dialog. We subscribe it to the leadgen webhook automatically.
                </p>
                <button onClick={handleFbOauth} disabled={fbOauthLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {fbOauthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect with Facebook"}
                </button>
              </div>

              {/* Option 2 — Manual token */}
              <div className="p-4 rounded-xl bg-black/20 border border-white/10">
                <h3 className="text-sm font-medium text-[#F0F7F3] mb-2">Option 2 — Paste a Page Access Token</h3>
                <p className="text-xs text-[#9FB0A6] mb-3">
                  Get a long-lived token from your Facebook app (Graph API Explorer → your Page → "Get Page Access Token",
                  with the <code className="text-[#6FE3B0]">leads_retrieval</code> or <code className="text-[#6FE3B0]">pages_manage_leads</code> permission).
                </p>
                <input value={fbToken} onChange={(e) => setFbToken(e.target.value)}
                  placeholder="EAAG... (Page Access Token)"
                  className="w-full px-4 py-2.5 rounded-xl app-card text-[#F0F7F3] text-sm placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60"
                />
                <button onClick={handleConnectFacebook} disabled={actionLoading === "fb-connect"}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[#F0F7F3] text-sm font-medium hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {actionLoading === "fb-connect" ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</> : "Save & Verify"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
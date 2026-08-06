"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Activity, Wifi, WifiOff, Loader2, RefreshCw, CheckCircle2, XCircle,
  MessageSquare, CreditCard, Brain, Phone, Mail, Database, Globe, Shield,
  Send, AlertTriangle, FileText,
} from "lucide-react";

interface IntegrationStatus {
  configured: boolean;
  missingVars?: string[];
  type?: string;
  provider?: string;
  circuitState?: string;
  circuitFailureCount?: number;
  circuitCooldownRemainingMs?: number;
  forwardingNumber?: string | null;
  forwardingEmail?: string | null;
  setupGuide?: string;
  available?: boolean;
  [key: string]: unknown;
}

interface HealthResponse {
  status: "all-configured" | "missing-configuration";
  unconfigured: string[];
  integrations: Record<string, IntegrationStatus>;
}

const INTEGRATION_META: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  whatsapp: { label: "WhatsApp", icon: <MessageSquare className="w-4 h-4" />, desc: "Notifications & chatbot" },
  sms: { label: "SMS Fallback", icon: <Send className="w-4 h-4" />, desc: "MessageBird" },
  email: { label: "Email (SMTP)", icon: <Mail className="w-4 h-4" />, desc: "Transactional emails" },
  voice_ai: { label: "Voice AI", icon: <Phone className="w-4 h-4" />, desc: "Omnidimension calls" },
  phone: { label: "Phone Numbers", icon: <Globe className="w-4 h-4" />, desc: "Number purchasing" },
  razorpay: { label: "Payments", icon: <CreditCard className="w-4 h-4" />, desc: "Razorpay billing" },
  sms_forwarding: { label: "SMS Forwarding", icon: <Send className="w-4 h-4" />, desc: "Lead ingestion via SMS" },
  email_forwarding: { label: "Email Forwarding", icon: <Mail className="w-4 h-4" />, desc: "Lead ingestion via email" },
  redis: { label: "Redis", icon: <Database className="w-4 h-4" />, desc: "Queues & automation" },
  platform_credits: { label: "Platform Credits", icon: <Activity className="w-4 h-4" />, desc: "Call cost tracking" },
};

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Public health endpoint (no auth prefix needed)
      const res = await api.get<HealthResponse>("/health/integrations");
      setHealth(res);
    } catch (err: any) {
      setError(err.message || "Failed to load integration health");
      toast.error("Failed to load integration health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const configuredCount = health
    ? Object.entries(health.integrations).filter(([, v]) => v.configured === true).length
    : 0;
  const totalCount = health ? Object.keys(health.integrations).length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Integration Health</h1>
          <p className="text-gray-400 mt-1">Live status of every external service — know exactly what's configured and what's missing</p>
        </div>
        <button onClick={loadHealth} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-all"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={loadHealth} className="mt-3 text-xs text-[#4F6EF7] hover:underline">
            Try Again
          </button>
        </div>
      ) : health ? (
        <>
          {/* Summary Banner */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-5 rounded-xl border flex items-center gap-4",
              health.status === "all-configured"
                ? "bg-green-500/10 border-green-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            )}
          >
            {health.status === "all-configured" ? (
              <Wifi className="w-6 h-6 text-green-400 shrink-0" />
            ) : (
              <WifiOff className="w-6 h-6 text-amber-400 shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">
                {health.status === "all-configured"
                  ? "✅ All integrations configured"
                  : `⚠️ ${health.unconfigured.length} integration${health.unconfigured.length > 1 ? "s" : ""} not configured`}
              </h3>
              {health.status !== "all-configured" && (
                <p className="text-xs text-amber-300/80 mt-1">
                  {health.unconfigured.map((u) => INTEGRATION_META[u]?.label || u).join(", ")} — these features are disabled or will fail silently.
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold text-white">{configuredCount}/{totalCount}</div>
              <div className="text-xs text-gray-500">configured</div>
            </div>
          </motion.div>

          {/* Integration Cards */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(health.integrations).map(([key, status], i) => {
              const meta = INTEGRATION_META[key] || { label: key, icon: <Activity className="w-4 h-4" />, desc: "" };
              const isOk = status.configured === true;
              const isRedis = key === "redis";
              const isOkRedis = isRedis ? status.available === true : isOk;

              return (
                <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className={cn(
                    "p-5 rounded-xl border transition-all",
                    isOkRedis ? "bg-white/5 border-white/10" : "bg-red-500/5 border-red-500/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        isOkRedis ? "bg-green-500/10" : "bg-red-500/10"
                      )}>
                        {meta.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
                        <p className="text-[11px] text-gray-500">{meta.desc}</p>
                      </div>
                    </div>
                    {isOkRedis ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                  </div>

                  {/* Extra detail */}
                  {key === "voice_ai" && status.circuitState && (
                    <div className="mt-3 text-[11px] text-gray-400">
                      Circuit: <span className={cn("font-medium", status.circuitState === "CLOSED" ? "text-green-400" : "text-red-400")}>{status.circuitState}</span>
                      {typeof status.circuitFailureCount === "number" && status.circuitFailureCount > 0 && (
                        <span className="text-red-400"> • {status.circuitFailureCount} failures</span>
                      )}
                    </div>
                  )}
                  {key === "phone" && status.provider && (
                    <div className="mt-3 text-[11px] text-gray-400">
                      Provider: <span className="text-gray-300 font-medium">{status.provider}</span>
                    </div>
                  )}
                  {key === "sms_forwarding" && (
                    <div className="mt-3 text-[11px] text-gray-400">
                      Number: <span className="font-mono text-gray-300">{status.forwardingNumber || "— not set —"}</span>
                    </div>
                  )}
                  {key === "email_forwarding" && (
                    <div className="mt-3 text-[11px] text-gray-400">
                      Email: <span className="font-mono text-gray-300">{status.forwardingEmail || "— not set —"}</span>
                    </div>
                  )}

                  {!isOkRedis && status.missingVars && status.missingVars.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-500/10">
                      <p className="text-[10px] uppercase tracking-wider text-red-400/70 mb-1.5">Missing env vars</p>
                      <div className="flex flex-wrap gap-1.5">
                        {status.missingVars.map((v) => (
                          <code key={v} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 text-[10px] font-mono">
                            {v}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isOkRedis && status.setupGuide && (
                    <p className="mt-3 text-[10px] text-gray-600 leading-relaxed">
                      <FileText className="w-3 h-3 inline mr-1" />
                      {status.setupGuide}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Unconfigured summary */}
          {health.unconfigured.length > 0 && (
            <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-amber-200">What this means</h3>
                  <p className="text-xs text-amber-300/70 mt-1 leading-relaxed">
                    The server still runs and leads are still ingested, but these integrations won't function:
                    WhatsApp notifications fail silently, brokers can't pay online, call recordings aren't stored,
                    and SMS/email lead forwarding won't ingest leads. Configure the missing env vars to unlock each feature.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

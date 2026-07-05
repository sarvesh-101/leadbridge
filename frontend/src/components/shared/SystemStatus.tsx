"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  AlertTriangle, Wifi, WifiOff, X, MessageSquare, Mail, Phone as PhoneIcon,
  CreditCard, Cpu, Database, ChevronDown, ChevronUp,
} from "lucide-react";

interface IntegrationHealth {
  configured: boolean;
  missingVars?: string[];
  type?: string;
  circuitState?: string;
  circuitFailureCount?: number;
  circuitCooldownRemainingMs?: number;
  available?: boolean;
}

interface HealthResponse {
  status: string;
  unconfigured: string[];
  integrations: Record<string, IntegrationHealth>;
}

const INTEGRATION_META: Record<string, {
  label: string;
  icon: React.ElementType;
  description: string;
  docsLink: string;
}> = {
  whatsapp: {
    label: "WhatsApp Cloud API",
    icon: MessageSquare,
    description: "Sends booking confirmations, reminders, and alerts to customers and owners.",
    docsLink: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  },
  sms: {
    label: "SMS Fallback (MessageBird)",
    icon: PhoneIcon,
    description: "Fallback channel when WhatsApp delivery fails. Ensures critical alerts reach you.",
    docsLink: "https://dashboard.messagebird.com/en/developers/access",
  },
  email: {
    label: "Email (Resend)",
    icon: Mail,
    description: "Used for password reset emails, booking confirmations, and monthly reports.",
    docsLink: "https://resend.com",
  },
  omnidimension: {
    label: "Omnidimension AI Voice",
    icon: Cpu,
    description: "AI-powered outbound calling for lead qualification, reminders, and follow-ups.",
    docsLink: "https://app.omnidim.io/dashboard/settings",
  },
  razorpay: {
    label: "Razorpay Billing",
    icon: CreditCard,
    description: "Subscription billing and payment processing for plan upgrades.",
    docsLink: "https://dashboard.razorpay.com",
  },
  redis: {
    label: "Redis (Queue System)",
    icon: Database,
    description: "Job queues for calls, notifications, follow-ups. Without it, async processing falls back.",
    docsLink: "#",
  },
};

export default function SystemStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<HealthResponse>("/health/integrations");
      setHealth(res);
    } catch {
      // Silently fail — component is not critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(load, 120_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading || !health || dismissed) return null;

  const unconfigured = health.unconfigured || [];
  const hasIssues = unconfigured.length > 0;

  // Check for Omnidimension circuit breaker issues
  const omni = health.integrations?.omnidimension;
  const omniDegraded = omni?.circuitState === "OPEN";

  if (!hasIssues && !omniDegraded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-yellow-200">
              {omniDegraded
                ? "Omnidimension circuit breaker open — AI calls may fail"
                : `${unconfigured.length} integration${unconfigured.length > 1 ? "s" : ""} not configured`
              }
            </p>
            <p className="text-xs text-yellow-400/70 mt-0.5">
              {unconfigured.length > 0
                ? "Some features will be unavailable. Click to see details."
                : "Voice calling is temporarily unavailable."
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-yellow-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-yellow-400/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-yellow-500/20"
          >
            <div className="px-4 py-3 space-y-2">
              {unconfigured.map((name) => {
                const meta = INTEGRATION_META[name];
                const integration = health.integrations?.[name];
                if (!meta || !integration) return null;

                return (
                  <div key={name} className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/5">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <meta.icon className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-yellow-200">{meta.label}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
                          Not configured
                        </span>
                      </div>
                      <p className="text-xs text-yellow-400/70 mt-1">{meta.description}</p>
                      {integration.missingVars && integration.missingVars.length > 0 && (
                        <div className="mt-1.5">
                          <span className="text-xs text-yellow-400/50">Missing env vars: </span>
                          <code className="text-xs bg-yellow-500/10 text-yellow-300 px-1.5 py-0.5 rounded">
                            {integration.missingVars.join(", ")}
                          </code>
                        </div>
                      )}
                      {meta.docsLink !== "#" && (
                        <a
                          href={meta.docsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 mt-1"
                        >
                          Setup guide →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Omnidimension degraded state */}
              {omniDegraded && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <WifiOff className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-red-200">Omnidimension Voice API</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                        Circuit Open
                      </span>
                    </div>
                    <p className="text-xs text-red-400/70 mt-1">
                      The AI calling API has failed {omni?.circuitFailureCount ?? 0} times. 
                      New calls are being blocked to prevent cascading failures.
                      {omni?.circuitCooldownRemainingMs && omni.circuitCooldownRemainingMs > 0
                        ? ` Auto-recovery in ${Math.ceil(omni.circuitCooldownRemainingMs / 60000)} minutes.`
                        : ""
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Configured services summary */}
              {Object.entries(INTEGRATION_META)
                .filter(([name]) => !unconfigured.includes(name) && !(name === "omnidimension" && omniDegraded))
                .map(([name, meta]) => {
                  const integration = health.integrations?.[name];
                  if (!integration?.configured && name !== "redis") return null;
                  return (
                    <div key={name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-green-500/5">
                      <Wifi className="w-3.5 h-3.5 text-green-400 shrink-0" />
                      <span className="text-xs text-green-300">{meta.label}</span>
                      {name === "omnidimension" && integration?.circuitState && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          integration.circuitState === "CLOSED" ? "bg-green-500/10 text-green-400" :
                          integration.circuitState === "HALF_OPEN" ? "bg-yellow-500/10 text-yellow-400" :
                          "bg-red-500/10 text-red-400"
                        )}>
                          {integration.circuitState}
                        </span>
                      )}
                      {name === "redis" && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded",
                          integration?.available ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                        )}>
                          {integration?.available ? "Available" : "Unavailable"}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

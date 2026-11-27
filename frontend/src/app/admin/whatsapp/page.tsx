"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  MessageSquare, Loader2, ExternalLink, Copy,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Send,
  Wifi, WifiOff, Shield, Smartphone, Globe, ArrowRight,
} from "lucide-react";

interface EnvVarStatus {
  value: string | null;
  set: boolean;
}

interface PhoneInfo {
  phoneNumber?: string;
  name?: string;
  qualityRating?: string;
}

interface SetupStep {
  step: number;
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
  code?: string;
  note?: string;
  description2?: string;
}

interface WhatsAppConfig {
  configured: boolean;
  phoneInfo: PhoneInfo | null;
  envVars: Record<string, EnvVarStatus>;
  webhookUrl: string;
  demoMode: boolean;
  message: string;
  setupGuide: {
    steps: SetupStep[];
  };
}

export default function AdminWhatsAppPage() {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [webhookTesting, setWebhookTesting] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.get<WhatsAppConfig>("/admin/whatsapp/config");
      setConfig(res);
    } catch (err: any) {
      toast.error("Failed to load WhatsApp config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  async function handleTestSend() {
    if (!testPhone.trim()) return toast.error("Enter a phone number");
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; messageId?: string; message: string }>(
        "/admin/whatsapp/test/send",
        { to: testPhone.trim() }
      );
      setTestResult({ success: true, message: res.message });
      toast.success("Test message sent!");
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Failed to send" });
      toast.error(err.message || "Failed to send test message");
    } finally {
      setTestSending(false);
    }
  }

  async function handleWebhookTest() {
    setWebhookTesting(true);
    setWebhookTestResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>(
        "/admin/whatsapp/test/webhook",
        {}
      );
      setWebhookTestResult({ success: true, message: res.message });
    } catch (err: any) {
      setWebhookTestResult({ success: false, message: err.message || "Webhook test failed" });
    } finally {
      setWebhookTesting(false);
    }
  }

  async function handleCopyUrl() {
    if (!config?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(config.webhookUrl);
      setCopied(true);
      toast.success("Webhook URL copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  const configuredCount = config
    ? Object.values(config.envVars).filter((v) => v.set).length
    : 0;
  const totalCount = config ? Object.keys(config.envVars).length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">WhatsApp Configuration</h1>
          <p className="text-ink-soft mt-1">Set up WhatsApp Cloud API for lead notifications and follow-ups</p>
        </div>
        <button onClick={loadConfig} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl app-card app-card-hover text-sm text-ink-soft hover:bg-white/[0.06] hover:text-ink disabled:opacity-50 transition-all"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl app-card animate-pulse" />
          ))}
        </div>
      ) : config ? (
        <>
          {/* Status Banner */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-5 rounded-xl border flex items-start gap-4",
              config.configured
                ? "bg-success/10 border-success/20"
                : config.demoMode
                ? "bg-warning/10 border-warning/20"
                : "bg-danger/10 border-danger/20"
            )}
          >
            {config.configured ? (
              <Wifi className="w-6 h-6 text-success shrink-0 mt-0.5" />
            ) : config.demoMode ? (
              <AlertCircle className="w-6 h-6 text-warning shrink-0 mt-0.5" />
            ) : (
              <WifiOff className="w-6 h-6 text-danger shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-ink">
                {config.configured
                  ? "✅ WhatsApp Cloud API is configured"
                  : config.demoMode
                  ? "⚠️ Demo Mode — WhatsApp is simulated"
                  : "❌ WhatsApp not configured"}
              </h3>
              <p className="text-xs text-ink-soft mt-1">{config.message}</p>
              {config.phoneInfo && (
                <div className="flex items-center gap-4 mt-3 text-xs text-ink-soft">
                  <span className="flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-success" />
                    {config.phoneInfo.phoneNumber}
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5 text-brand" />
                    {config.phoneInfo.name}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] capitalize",
                    config.phoneInfo.qualityRating === "green" ? "bg-success/10 text-success" :
                    config.phoneInfo.qualityRating === "yellow" ? "bg-warning/10 text-warning" :
                    "bg-danger/10 text-danger"
                  )}>
                    Quality: {config.phoneInfo.qualityRating}
                  </span>
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold text-ink">{configuredCount}/{totalCount}</div>
              <div className="text-xs text-ink-soft">Env vars set</div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <div className="grid sm:grid-cols-3 gap-4">
            {/* Test Send */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-xl app-card"
            >
              <Send className="w-5 h-5 text-brand mb-3" />
              <h3 className="text-sm font-semibold text-ink mb-3">Send Test Message</h3>
              <div className="space-y-2">
                <input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 rounded-lg app-card text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand/50/50"
                />
                <button onClick={handleTestSend} disabled={testSending || !testPhone.trim() || !config.configured}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-line-subtle text-white text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-all"
                >
                  {testSending ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="w-3.5 h-3.5" /> Send Test</>
                  )}
                </button>
              </div>
              {testResult && (                  <p className={cn("text-xs mt-2", testResult.success ? "text-success" : "text-danger")}>
                  {testResult.message}
                </p>
              )}
            </motion.div>

            {/* Webhook URL */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="p-5 rounded-xl app-card"
            >
              <Globe className="w-5 h-5 text-brand mb-3" />
              <h3 className="text-sm font-semibold text-ink mb-3">Webhook URL</h3>
              <div className="flex items-center gap-1.5 p-2 rounded-lg app-card">
                <code className="flex-1 text-[11px] text-ink-soft truncate font-mono">
                  {config.webhookUrl}
                </code>
                <button onClick={handleCopyUrl}
                  className="p-1.5 rounded-md hover:bg-white/[0.06] text-ink-soft hover:text-ink transition-all shrink-0"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-ink-soft mt-2">
                Add this URL in Meta WhatsApp Manager → Webhook configuration
              </p>
            </motion.div>

            {/* Webhook Test */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="p-5 rounded-xl app-card"
            >
              <Shield className="w-5 h-5 text-brand mb-3" />
              <h3 className="text-sm font-semibold text-ink mb-3">Verify Token Test</h3>
              <button onClick={handleWebhookTest} disabled={webhookTesting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs font-medium hover:bg-warning/20 disabled:opacity-50 transition-all"
              >
                {webhookTesting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing...</>
                ) : (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Test Webhook Verification</>
                )}
              </button>
              {webhookTestResult && (                  <p className={cn("text-xs mt-2", webhookTestResult.success ? "text-success" : "text-danger")}>
                  {webhookTestResult.message}
                </p>
              )}
            </motion.div>
          </div>

          {/* Environment Variables Status */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="p-5 rounded-xl app-card"
          >
            <h3 className="text-sm font-semibold text-ink mb-4">Environment Variables</h3>
            <div className="space-y-2">
              {Object.entries(config.envVars).map(([key, env]) => (
                <div key={key}
                  className="flex items-center justify-between p-3 rounded-lg app-card"
                >
                  <div className="flex items-center gap-3">
                    {env.set ? (                        <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-danger" />
                    )}
                    <div>
                      <code className="text-sm text-ink font-mono">{key}</code>
                      <p className="text-[10px] text-ink-soft mt-0.5">
                        {env.value || "Not set"}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",                      env.set ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                  )}>
                    {env.set ? "Set" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Setup Guide */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="p-5 rounded-xl app-card"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-ink">Step-by-Step Setup Guide</h3>
                <p className="text-xs text-ink-soft mt-0.5">Follow these steps to configure WhatsApp Cloud API</p>
              </div>
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                Meta Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-3">
              {config.setupGuide.steps.map((step, i) => {
                const isOpen = activeStep === step.step;
                return (
                  <motion.div key={step.step}
                    className={cn(
                      "rounded-xl border transition-all cursor-pointer",
                      isOpen
                        ? "bg-brand/10 border-brand/30"
                        : "bg-canvas border-line hover:bg-white/[0.06]"
                    )}
                    onClick={() => setActiveStep(isOpen ? null : step.step)}
                  >
                    <div className="flex items-start gap-3 p-4">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                        isOpen ? "bg-line-subtle text-white" : "bg-white/[0.06] text-ink-soft"
                      )}>
                        {step.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-medium text-ink">{step.title}</h4>
                          <ArrowRight className={cn(
                            "w-4 h-4 text-ink-soft transition-transform shrink-0",
                            isOpen && "rotate-90"
                          )} />
                        </div>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 space-y-3"
                            >
                              <p className="text-xs text-ink-soft leading-relaxed">
                                {step.description}
                              </p>
                              {step.code && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-line">
                                  <code className="flex-1 text-[11px] text-brand font-mono break-all">
                                    {step.code}
                                  </code>
                                  <button onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(step.code!);
                                    toast.success("Copied!");
                                  }}
                                    className="p-1.5 rounded-md hover:bg-white/[0.06] text-ink-soft hover:text-ink"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                              {step.description2 && (
                                <p className="text-xs text-ink-soft">{step.description2}</p>
                              )}
                              {step.note && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/5 border border-warning/10">
                                  <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-warning">{step.note}</p>
                                </div>
                              )}
                              {step.link && (
                                <a href={step.link} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {step.linkLabel || "Open"} <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Message Branding Preview */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="p-5 rounded-xl app-card"
          >
            <h3 className="text-sm font-semibold text-ink mb-3">Message Preview (How Leads See It)</h3>
            <p className="text-xs text-ink-soft mb-4">
              All messages come from Converza's WhatsApp number but include the broker's business name prominently.
            </p>
            <div className="space-y-3">
              {[
                {
                  label: "Booking Confirmation",
                  preview: `Namaste Rajesh ji!
                  
Aapki property visit confirm ho gayi hai.

Property: 2BHK in Powai
Address: Hiranandani Gardens, Powai
Date: Monday, 25 July 2026
Time: 11:00 AM

Suresh Properties aapse milenge.
Unka number: +91 9876543210

Directions: maps.google.com/...

— Suresh Properties`,
                  highlight: "Suresh Properties",
                },
                {
                  label: "Follow-up D2 (WhatsApp)",
                  preview: `Namaste,

Hum samajhte hain aap kal nahi aa paaye.

Kya aap abhi bhi Powai mein property dekhne mein interested hain?

— Suresh Properties`,
                  highlight: "Suresh Properties",
                },
                {
                  label: "Reminder",
                  preview: `Namaste Rajesh ji!

Aaj aapki property visit hai.

Time: 11:00 AM
Address: Hiranandani Gardens, Powai

Suresh Properties aapka intezaar kar rahe hain.

— Suresh Properties`,
                  highlight: "Suresh Properties",
                },
              ].map((msg, i) => (
                <div key={i} className="p-4 rounded-xl app-card">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-brand" />
                    <span className="text-xs font-medium text-ink-soft">{msg.label}</span>
                  </div>
                  <pre className="text-xs text-ink-soft font-sans whitespace-pre-wrap leading-relaxed">
                    {msg.preview}
                  </pre>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-soft">
                    <CheckCircle2 className="w-3 h-3 text-success" />
                    Broker brand highlighted: <strong className="text-ink">"{msg.highlight}"</strong> appears in message
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      ) : (
        <div className="p-8 rounded-xl app-card text-center">
          <MessageSquare className="w-10 h-10 text-ink-soft mx-auto mb-3" />
          <p className="text-sm text-ink-soft">Failed to load WhatsApp configuration.</p>
          <button onClick={loadConfig} className="mt-3 text-xs text-brand hover:underline">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

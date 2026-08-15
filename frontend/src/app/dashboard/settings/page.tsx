"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  User, Bot, Link as LinkIcon, Bell, Shield, Save, Key, Smartphone,
  Phone, BookOpen, Plus, Trash2, Upload, Check, X, Globe, Loader2,
  ExternalLink, Radio, RadioTower, Copy, ArrowRight, ShieldCheck,
  FileText, AlertTriangle,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import Link from "next/link";
import { FeatureGateCard } from "@/components/shared/FeatureGate";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "integrations", label: "Integrations", icon: LinkIcon },
  { id: "security", label: "Security", icon: Shield },
  { id: "privacy", label: "Privacy & Data", icon: ShieldCheck },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and platform configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
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

      {/* ─── Profile Tab ───────────────────────────────────────── */}
      {activeTab === "profile" && <ProfileTab />}

      {/* ─── Integrations Tab ──────────────────────────────────── */}
      {activeTab === "integrations" && <IntegrationsTab />}

      {/* ─── Security Tab ───────────────────────────────────────── */}
      {activeTab === "security" && <SecurityTab />}

      {/* ─── Privacy & Data Tab (DPDP Phase 1.3) ─────────────────── */}
      {activeTab === "privacy" && <PrivacyTab />}
    </div>
  );
}

// ─── Privacy & Data Tab (DPDP Phase 1.3) ────────────────────────

function PrivacyTab() {
  const [privacy, setPrivacy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<any>("/me/privacy");
        setPrivacy(res);
      } catch {
        // Privacy API unavailable — show the static fallback below
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function requestErasure() {
    setRequesting(true);
    try {
      const res = await api.post<any>("/me/privacy/erasure-request");
      // Merge, don't replace: the POST response only carries erasure fields,
      // so the consent status would otherwise flip to "No consent recorded".
      setPrivacy((prev: any) => ({ ...(prev || {}), ...res }));
      setConfirmOpen(false);
      toast.success("Erasure request received");
    } catch (err: any) {
      toast.error(err.message || "Could not submit your request");
    } finally {
      setRequesting(false);
    }
  }

  const consentDate = privacy?.consentGivenAt
    ? new Date(privacy.consentGivenAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const requestedDate = privacy?.erasureRequestedAt
    ? new Date(privacy.erasureRequestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-white/5 rounded-xl" />
        <div className="h-32 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Consent status */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Privacy & Consent</h2>
            <p className="text-xs text-gray-500">India DPDP Act 2023 — your data, your control</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
            privacy?.consentActive
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
          )}>
            <Check className="w-3.5 h-3.5" />
            {privacy?.consentActive
              ? `Consent given${consentDate ? ` on ${consentDate}` : ""} (Privacy Policy v${privacy.consentVersion || "1.0"})`
              : "No consent recorded"}
          </span>
          <Link href="/legal/privacy" target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-white/10 transition-colors">
            <FileText className="w-3.5 h-3.5" /> Read the Privacy Policy
          </Link>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          We process your account, lead, call-recording and billing data only as described in the
          Privacy Policy. You can withdraw consent at any time by requesting full data erasure below.
        </p>
      </div>

      {/* Erasure request */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Delete my account & data</h2>
            <p className="text-xs text-gray-500">Withdraw consent and erase all personal data (DPDP right to erasure)</p>
          </div>
        </div>

        {privacy?.erasureProcessedAt ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm text-emerald-400">
              ✓ Your account and data have been erased. Thank you for using LeadBridge.
            </p>
          </div>
        ) : privacy?.erasureRequested ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-400 font-medium">Erasure request received{requestedDate ? ` on ${requestedDate}` : ""}</p>
            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
              We will delete your account and personal data within {privacy.slaDays ?? 30} days, as
              stated in our Privacy Policy. Your account remains accessible until then.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 leading-relaxed">
              This permanently deletes your account, leads, call recordings, invoices and all related
              data after the processing window. This cannot be undone.
            </p>
            <button onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-medium hover:bg-rose-500/25 transition-colors">
              <Trash2 className="w-4 h-4" /> Request data erasure
            </button>
          </>
        )}

        <AnimatePresence>
          {confirmOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md p-6 rounded-2xl bg-[#16181F] border border-white/10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Permanently delete everything?</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Your account, leads, call recordings, invoices and all personal data will be erased
                  within {privacy?.slaDays ?? 30} days of this request. This action cannot be undone.
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={() => setConfirmOpen(false)} disabled={requesting}
                    className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-colors">
                    Cancel
                  </button>
                  <button onClick={requestErasure} disabled={requesting}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors">
                    {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {requesting ? "Submitting…" : "Yes, delete my data"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────

function ProfileTab() {
  const { user } = useAuthStore();
  const [name, setName] = useState(user?.name || user?.ownerName || "");
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api.get("/me");
        const client = data.client;
        if (client) {
          setName(client.ownerName || client.name || "");
          setBusinessName(client.businessName || "");
          setPhone(client.phone || "");
        }
      } catch (err: any) {
        // Use existing values from auth store
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch("/me", { ownerName: name, businessName, phone });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  const initials = (user?.name || user?.ownerName || "U").charAt(0).toUpperCase();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-5">
      <h2 className="text-lg font-semibold text-white">Profile Information</h2>
      {loadingProfile ? (
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-white/10" />
            <div className="h-4 w-24 bg-white/10 rounded" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white/10 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-leadflow-500 to-leadflow-accent flex items-center justify-center text-xl font-bold text-white">
              {initials}
            </div>
            <div className="text-sm text-gray-400">{user?.email || ""}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input value={user?.email || ""} disabled
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-500 text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Business</label>
              <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Integrations Tab ───────────────────────────────────────────

function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/integrations").catch(() => null);
        setIntegrations(res?.items || []);
      } catch {}
      finally { setLoading(false); }
    }
    load();
  }, []);

  // Determine if critical services are connected
  const whatsappConnected = integrations.some(i => i.provider === "whatsapp" && i.status === "ACTIVE");
  const omnidimensionConnected = integrations.some(i => i.provider === "omnidimension" && i.status === "ACTIVE");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Feature gate: Team is GROWTH+ */}
      <FeatureGateCard
        featureName="Team Management"
        requiredPlan="GROWTH"
        currentPlan={useAuthStore.getState().user?.plan}
        description="Invite team members to manage leads together"
      />

      {/* Feature gate: Email Campaigns is PRO */}
      <FeatureGateCard
        featureName="Email Campaigns"
        requiredPlan="PRO"
        currentPlan={useAuthStore.getState().user?.plan}
        description="Send bulk email campaigns to your leads"
      />

      {/* Feature gate: SMS Campaigns is PRO */}
      <FeatureGateCard
        featureName="SMS Campaigns"
        requiredPlan="PRO"
        currentPlan={useAuthStore.getState().user?.plan}
        description="Send SMS campaigns to your leads"
      />

      {/* Voice AI quick settings card */}
      <Link href="/dashboard/voice"
        className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-[#3B82F6]/10 to-[#6B8AFF]/5 border border-[#3B82F6]/20 hover:border-[#3B82F6]/40 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/20 flex items-center justify-center">
            <Phone className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-[#3B82F6] transition-colors">Voice AI Agent</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure your AI calling agent, phone numbers, and knowledge base
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-[#3B82F6] transition-colors" />
      </Link>

      {/* Other integrations */}
      {[
        { name: "WhatsApp Cloud API", status: whatsappConnected ? "Connected" : "Disconnected", icon: "💬", color: whatsappConnected ? "text-green-400" : "text-gray-400" },
        { name: "AI Voice", status: omnidimensionConnected ? "Active" : "Not configured", icon: "🎙️", color: omnidimensionConnected ? "text-blue-400" : "text-gray-400" },
        { name: "Google Ads", status: "Available", icon: "🔍", color: "text-gray-400" },
        { name: "Facebook Leads", status: "Available", icon: "📘", color: "text-gray-400" },
      ].map((int) => (
        <div key={int.name} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{int.icon}</span>
            <div>
              <div className="text-sm font-medium text-white">{int.name}</div>
              <div className={cn("text-xs", int.color)}>{int.status}</div>
            </div>
          </div>
          <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">Configure</button>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Security Tab ───────────────────────────────────────────────

function SecurityTab() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(true);

  useEffect(() => {
    async function loadSecurity() {
      try {
        const [webhookRes] = await Promise.all([
          api.get<{ webhooks: any[] }>("/settings/webhooks"),
        ]);
        setWebhooks(webhookRes.webhooks || []);
      } catch {
        // Settings APIs may not be available
      } finally {
        setLoadingSecurity(false);
      }
    }
    loadSecurity();
  }, []);

  async function generateApiKey() {
    try {
      const res = await api.post<{ source: { id: string; token: string; name: string } }>("/settings/webhooks", {
        name: "API Key",
        type: "api",
        parserConfig: {},
      });
      if (res?.source?.token) {
        setApiKeyValue(res.source.token);
        setShowApiKey(true);
        const webhookRes = await api.get<{ webhooks: any[] }>("/settings/webhooks").catch(() => null);
        if (webhookRes) setWebhooks(webhookRes.webhooks || []);
        toast.success("API key generated");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate API key");
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* API Key Section */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <h2 className="text-lg font-semibold text-white">Security Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-white">API Keys</div>
                <div className="text-xs text-gray-500">Manage your API access keys for integrations</div>
              </div>
            </div>
            <button onClick={generateApiKey}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-xs font-medium hover:opacity-90"
            >
              Generate Key
            </button>
          </div>

          {showApiKey && apiKeyValue && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400 font-medium mb-2">Your API Key (copy it now — won&apos;t be shown again)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-amber-200 bg-amber-500/10 px-3 py-2 rounded-lg break-all font-mono">
                  {apiKeyValue}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(apiKeyValue); toast.success("Copied!"); }}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/30"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Webhooks Section */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-white">Webhook Sources</h3>
              <p className="text-xs text-gray-500">Incoming webhook endpoints for lead ingestion</p>
            </div>
          </div>
        </div>

        {loadingSecurity ? (
          <div className="animate-pulse space-y-3">
            {[1,2].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500">No webhook sources configured yet.</p>
            <p className="text-xs text-gray-600 mt-1">Configure webhook sources in the Integrations section.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh: any) => (
              <div key={wh.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <div className="text-sm text-white">{wh.name}</div>
                  <div className="text-xs text-gray-500">{wh.type} · {wh.active ? "Active" : "Inactive"}</div>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`/api/v1/webhooks/ingest/${wh.token}`); toast.success("Webhook URL copied!"); }}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy URL
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
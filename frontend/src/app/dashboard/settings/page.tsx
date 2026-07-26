"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  User, Bot, Link as LinkIcon, Bell, Shield, Save, Key, Smartphone,
  Phone, BookOpen, Plus, Trash2, Upload, Check, X, Globe, Loader2,
  ExternalLink, Radio, RadioTower, Copy, ArrowRight,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import Link from "next/link";
import { FeatureGateCard } from "@/components/shared/FeatureGate";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "integrations", label: "Integrations", icon: LinkIcon },
  { id: "security", label: "Security", icon: Shield },
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
    </div>
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
        className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-[#4F6EF7]/10 to-[#6B8AFF]/5 border border-[#4F6EF7]/20 hover:border-[#4F6EF7]/40 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#4F6EF7]/20 flex items-center justify-center">
            <Phone className="w-6 h-6 text-[#4F6EF7]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white group-hover:text-[#4F6EF7] transition-colors">Voice AI Agent</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure your AI calling agent, phone numbers, and knowledge base
            </p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-[#4F6EF7] transition-colors" />
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
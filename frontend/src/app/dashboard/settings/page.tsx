"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { User, Bot, Link as LinkIcon, Bell, Shield, Save, Key, Smartphone } from "lucide-react";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "ai-config", label: "AI Configuration", icon: Bot },
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
              activeTab === tab.id ? "bg-leadflow-500/20 text-leadflow-accent border border-leadflow-500/30" : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Settings */}
      {activeTab === "profile" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-5">
          <h2 className="text-lg font-semibold text-white">Profile Information</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-leadflow-500 to-leadflow-accent flex items-center justify-center text-xl font-bold text-white">JD</div>
            <div><button className="text-sm text-leadflow-accent hover:underline">Change photo</button></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[{ label: "First Name", value: "John", placeholder: "First name" },
              { label: "Last Name", value: "Doe", placeholder: "Last name" },
              { label: "Email", value: "john@example.com", placeholder: "Email" },
              { label: "Phone", value: "+91 98765 43210", placeholder: "Phone" },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-sm text-gray-400 mb-1.5">{f.label}</label>
                <input defaultValue={f.value} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Company</label>
            <input defaultValue="ABC Realty" className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50" />
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90">
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </motion.div>
      )}

      {/* AI Config */}
      {activeTab === "ai-config" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-5">
          <h2 className="text-lg font-semibold text-white">AI Agent Configuration</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[{ label: "AI Agent Name", value: "LeadFlow Assistant" },
              { label: "Language", value: "English (en)" },
              { label: "LLM Model", value: "DeepSeek Chat" },
              { label: "Voice", value: "Cartesia - Default" },
            ].map((f) => (
              <div key={f.label}>
                <label className="block text-sm text-gray-400 mb-1.5">{f.label}</label>
                <input defaultValue={f.value} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Greeting Message</label>
            <textarea defaultValue="Hello! This is LeadFlow AI Assistant calling from [Company Name]." rows={3} className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-leadflow-500/50" />
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90">
            <Save className="w-4 h-4" /> Save AI Config
          </button>
        </motion.div>
      )}

      {/* Integrations */}
      {activeTab === "integrations" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {[
            { name: "IndiaMart", status: "Connected", icon: "🏭", color: "text-green-400" },
            { name: "Justdial", status: "Disconnected", icon: "📞", color: "text-gray-400" },
            { name: "WhatsApp Cloud API", status: "Connected", icon: "💬", color: "text-green-400" },
            { name: "Exotel", status: "Configured", icon: "📱", color: "text-blue-400" },
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
      )}

      {/* Security */}
      {activeTab === "security" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-5">
          <h2 className="text-lg font-semibold text-white">Security Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-gray-400" />
                <div><div className="text-sm text-white">API Key</div><div className="text-xs text-gray-500">Manage your API access keys</div></div>
              </div>
              <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">View Keys</button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-gray-400" />
                <div><div className="text-sm text-white">Two-Factor Auth</div><div className="text-xs text-gray-500">Add extra security to your account</div></div>
              </div>
              <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">Enable</button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-400" />
                <div><div className="text-sm text-white">Webhook Notifications</div><div className="text-xs text-gray-500">Configure webhook endpoints for events</div></div>
              </div>
              <button className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-300 hover:bg-white/5">Configure</button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

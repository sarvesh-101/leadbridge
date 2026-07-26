"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Bell, BellOff, MessageSquare, Smartphone, Mail,
  Loader2, RefreshCw, CheckCircle2,
} from "lucide-react";

interface Preference {
  id: string;
  eventType: string;
  channels: string[];
  enabled: boolean;
}

interface EventTypeOption {
  value: string;
  label: string;
}

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "text-[#22D3A5]" },
  { value: "sms", label: "SMS", icon: Smartphone, color: "text-blue-400" },
  { value: "email", label: "Email", icon: Mail, color: "text-amber-400" },
];

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadPrefs(); }, []);

  async function loadPrefs() {
    setLoading(true);
    try {
      const res = await api.get<{ preferences: Preference[]; eventTypes: EventTypeOption[] }>("/notifications/preferences");
      setPreferences(res.preferences || []);
      setEventTypes(res.eventTypes || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  }

  function getPref(eventType: string): Preference | undefined {
    return preferences.find((p) => p.eventType === eventType);
  }

  function toggleEvent(eventType: string) {
    setPreferences((prev) =>
      prev.map((p) =>
        p.eventType === eventType ? { ...p, enabled: !p.enabled } : p
      )
    );
  }

  function toggleChannel(eventType: string, channel: string) {
    setPreferences((prev) =>
      prev.map((p) => {
        if (p.eventType !== eventType) return p;
        const channels = p.channels.includes(channel)
          ? p.channels.filter((c) => c !== channel)
          : [...p.channels, channel];
        return { ...p, channels, enabled: channels.length > 0 ? true : p.enabled };
      })
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      // API expects PUT but we use PATCH since axios/fetch abstraction doesn't have put
      await api.patch("/notifications/preferences", {
        preferences: preferences.map((p) => ({
          eventType: p.eventType,
          channels: p.channels,
          enabled: p.enabled,
        })),
      });
      toast.success("Preferences saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      await api.post("/notifications/preferences/reset");
      toast.success("Reset to defaults");
      await loadPrefs();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notification Preferences</h1>
          <p className="text-gray-400 mt-1">Choose which events trigger notifications and how you receive them</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Preferences
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
      ) : preferences.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <Bell className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-2">No preferences configured</h3>
          <p className="text-sm text-gray-500">Default preferences will be created when you save your first settings</p>
        </div>
      ) : (
        <div className="space-y-2">
          {preferences.map((pref, i) => {
            const eventLabel = eventTypes.find((e) => e.value === pref.eventType)?.label || pref.eventType.replace(/_/g, " ");
            return (
              <motion.div key={pref.id || pref.eventType} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all"
              >
                {/* Toggle */}
                <button onClick={() => toggleEvent(pref.eventType)}
                  className={cn(
                    "relative w-11 h-6 rounded-full transition-colors shrink-0",
                    pref.enabled ? "bg-[#22D3A5]" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm",
                    pref.enabled ? "translate-x-[22px]" : "translate-x-0.5"
                  )} />
                </button>

                {/* Event label */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {pref.enabled ? <Bell className="w-4 h-4 text-[#22D3A5]" /> : <BellOff className="w-4 h-4 text-gray-500" />}
                    <span className="text-sm font-medium text-white">{eventLabel}</span>
                  </div>
                </div>

                {/* Channel toggles */}
                <div className="flex items-center gap-2">
                  {CHANNELS.map((ch) => {
                    const active = pref.channels?.includes(ch.value);
                    return (
                      <button key={ch.value} onClick={() => toggleChannel(pref.eventType, ch.value)}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                          active
                            ? `${ch.color} bg-white/5 border-white/10`
                            : "text-gray-600 border-transparent hover:text-gray-400"
                        )}
                        title={ch.label}
                      >
                        <ch.icon className="w-3 h-3" />
                        <span className="hidden sm:inline">{ch.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-white mb-1">How notifications work</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Notifications are sent in real-time via WebSocket when the dashboard is open.
              WhatsApp and SMS notifications are sent through your configured integrations.
              Email notifications require SMTP configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

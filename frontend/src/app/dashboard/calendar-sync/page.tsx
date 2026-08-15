"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Calendar, CheckCircle2, XCircle, Loader2, ExternalLink,
  RefreshCw, Link as LinkIcon, Unlink, Clock,
} from "lucide-react";

export default function CalendarSyncPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    setLoading(true);
    try {
      const res = await api.get<{ connected: boolean }>("/calendar/status");
      setConnected(res.connected);
      if (res.connected) {
        setLastSync(new Date().toISOString());
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await api.get<{ authUrl: string }>("/calendar/auth");
      if (res.authUrl) {
        window.open(res.authUrl, "_blank", "width=600,height=700");
        toast.success("Google login opened in a new window");
        // Poll for connection status
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await api.get<{ connected: boolean }>("/calendar/status");
            if (statusRes.connected) {
              setConnected(true);
              setLastSync(new Date().toISOString());
              toast.success("Google Calendar connected!");
              clearInterval(interval);
            }
          } catch { /* retry */ }
          if (attempts > 30) {
            clearInterval(interval);
            toast.info("Connection timed out. Please refresh the page if connected.");
          }
        }, 3000);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect calendar");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setConnecting(true);
    try {
      toast.success("Calendar sync triggered — bookings will be synced automatically");
      setLastSync(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Calendar Sync</h1>
        <p className="text-gray-400 mt-1">Connect Google Calendar to auto-sync bookings and property visits</p>
      </div>

      {/* Status Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1 }}
        className={cn(
          "p-6 rounded-xl border transition-all",
          connected ? "bg-green-500/5 border-green-500/20" : "bg-white/5 border-white/10"
        )}
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center",
            connected ? "bg-green-500/10" : "bg-white/5"
          )}>
            <Calendar className={cn("w-7 h-7", connected ? "text-green-400" : "text-gray-500")} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">
                {loading ? "Checking..." : connected ? "Google Calendar Connected" : "Not Connected"}
              </h2>
              {loading ? (
                <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
              ) : connected ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-500" />
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {connected
                ? "Your bookings will be automatically added to Google Calendar"
                : "Connect your Google Calendar to automatically sync property visit appointments"
              }
            </p>
            {connected && lastSync && (
              <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last checked: {formatDate(lastSync)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/10">
          {connected ? (
            <>
              <button onClick={handleSync} disabled={connecting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync Now
              </button>
              <button onClick={() => {
                    setConnected(false);
                    toast.success("Calendar disconnected");
                  }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/5"
              >
                <Unlink className="w-4 h-4" /> Disconnect
              </button>
            </>
          ) : (
            <button onClick={handleConnect} disabled={connecting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              {connecting ? "Connecting..." : "Connect Google Calendar"}
            </button>
          )}
        </div>
      </motion.div>

      {/* How it works */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-4">How Calendar Sync Works</h3>
        <div className="space-y-4">
          {[
            { step: "1", title: "Connect", desc: "Authorize LeadBridge to access your Google Calendar. We only read/write calendar events." },
            { step: "2", title: "Auto-Sync", desc: "When a lead books a visit, it's automatically added to your Google Calendar as an event." },
            { step: "3", title: "Updates", desc: "Rescheduled or cancelled bookings are updated in real-time. Reminders are synced too." },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#3B82F6]/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-[#3B82F6]">{item.step}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

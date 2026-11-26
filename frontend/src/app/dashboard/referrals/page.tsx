"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Users, TrendingUp, Award, Calendar,
  Loader2, UserPlus, Star,
} from "lucide-react";

export default function ReferralsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const res = await api.get("/referrals/stats");
      setStats(res.stats);
    } catch {
      toast.error("Failed to load referral stats");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordReferral() {
    if (!leadId.trim() || !referredBy.trim()) {
      return toast.error("Lead ID and referrer name are required");
    }
    setSaving(true);
    try {
      await api.post("/referrals/record", { leadId: leadId.trim(), referredBy: referredBy.trim() });
      toast.success("Referral recorded!");
      setShowRecordModal(false);
      setLeadId("");
      setReferredBy("");
      await loadStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to record referral");
    } finally {
      setSaving(false);
    }
  }

  const maxReferrals = stats?.topReferrers?.length > 0
    ? Math.max(...stats.topReferrers.map((r: any) => r.count), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Referral Tracking</h1>
          <p className="text-ink-soft mt-1">Track leads that come from customer referrals</p>
        </div>
        <button onClick={() => setShowRecordModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Record Referral
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl app-card animate-pulse" />)
        ) : (
          [
            { icon: Users, label: "Total Referrals", value: stats?.totalReferrals || 0, color: "from-blue-500 to-blue-600" },
            { icon: Award, label: "Converted", value: stats?.convertedReferrals || 0, color: "from-success to-success" },
            { icon: TrendingUp, label: "Conversion Rate", value: `${stats?.conversionRate || 0}%`, color: "from-purple-500 to-purple-600" },
            { icon: Star, label: "Top Referrer", value: stats?.topReferrers?.[0]?.name || "—", color: "from-warning to-warning" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl app-card">
              <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
                <s.icon className="w-4 h-4 text-white" />
              </div>
              <div className="text-lg font-bold text-ink">{s.value}</div>
              <div className="text-xs text-ink-soft">{s.label}</div>
            </div>
          ))
        )}
      </div>

      {/* Top Referrers */}
      <div className="p-5 rounded-xl app-card">
        <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-warning" />
          Top Referrers
        </h3>
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-canvas rounded-lg animate-pulse" />)}</div>
        ) : stats?.topReferrers?.length > 0 ? (
          <div className="space-y-2">
            {stats.topReferrers.map((r: any, i: number) => (
              <div key={r.name} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.06] border border-line">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                  i === 0 ? "bg-warning/20 text-warning" :
                  i === 1 ? "bg-surface-raised/20 text-ink-soft" :
                  i === 2 ? "bg-orange-600/20 text-orange-500" :
                  "bg-white/[0.06] text-ink-soft"
                )}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{r.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-warning" style={{ width: `${(r.count / maxReferrals) * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono text-ink font-bold">{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-ink-soft mx-auto mb-2" />
            <p className="text-sm text-ink-soft">No referrals recorded yet</p>
          </div>
        )}
      </div>

      {/* Monthly Trend */}
      {stats?.monthlyTrend?.length > 0 && (
        <div className="p-5 rounded-xl app-card">
          <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand" />
            Monthly Referral Trend
          </h3>
          <div className="flex items-end gap-2 h-24">
            {stats.monthlyTrend.map((m: any, i: number) => {
              const maxCount = Math.max(...stats.monthlyTrend.map((t: any) => t.count), 1);
              const height = Math.max((m.count / maxCount) * 100, 5);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-line-subtle to-brand-deep transition-all"
                    style={{ height: `${height}%` }}
                  >
                    <div className="text-[9px] text-ink text-center font-mono pt-1">{m.count}</div>
                  </div>
                  <span className="text-[9px] text-ink-soft">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Record Referral Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => { if (!saving) setShowRecordModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl app-card p-6"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink mb-4">Record Referral</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">Lead ID</label>
                <input value={leadId} onChange={e => setLeadId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg app-card text-ink text-sm"
                  placeholder="Enter the lead ID" />
              </div>
              <div>
                <label className="block text-xs text-ink-soft mb-1.5">Referred By</label>
                <input value={referredBy} onChange={e => setReferredBy(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg app-card text-ink text-sm"
                  placeholder="Customer name or phone" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowRecordModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-line text-ink-soft text-sm hover:bg-white/[0.06]"
              >Cancel</button>
              <button onClick={handleRecordReferral} disabled={saving || !leadId.trim() || !referredBy.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Record Referral
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Mail, Eye, MousePointerClick, Clock, Loader2, BarChart3, Users, Target, FlaskConical, Trophy } from "lucide-react";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningAbCheck, setRunningAbCheck] = useState(false);

  useEffect(() => {
    if (params.id) loadCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function loadCampaign() {
    try {
      const res = await api.get(`/campaigns/email/${params.id}`);
      setCampaign(res);
    } catch { toast.error("Failed to load campaign"); }
    finally { setLoading(false); }
  }

  async function triggerAbCheck() {
    setRunningAbCheck(true);
    try {
      const res = await api.post(`/campaigns/email/${params.id}/ab-check`);
      toast.success(`Winner: ${res.winner} — ${res.sentToHoldout} holdout emails sent`);
      await loadCampaign();
    } catch (err: any) { toast.error(err.message); }
    finally { setRunningAbCheck(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-500" /></div>;
  if (!campaign) return <div className="text-center py-16 text-gray-500">Campaign not found</div>;

  const { campaign: c, recentEvents } = campaign;
  const openRate = c.deliveredCount > 0 ? Math.round((c.openedCount / c.deliveredCount) * 100) : 0;
  const clickRate = c.deliveredCount > 0 ? Math.round((c.clickedCount / c.deliveredCount) * 100) : 0;

  // Time-series grouping
  const eventsByHour: Record<string, { opens: number; clicks: number }> = {};
  (recentEvents || []).forEach((e: any) => {
    const hour = new Date(e.createdAt).toLocaleDateString() + " " + new Date(e.createdAt).getHours() + ":00";
    if (!eventsByHour[hour]) eventsByHour[hour] = { opens: 0, clicks: 0 };
    if (e.event === "open") eventsByHour[hour].opens++;
    if (e.event === "click") eventsByHour[hour].clicks++;
  });
  const timeline = Object.entries(eventsByHour).slice(-24);
  const maxCount = Math.max(...timeline.map(([, v]) => Math.max(v.opens, v.clicks)), 1);

  const abData = c.abTestEnabled ? (typeof c.abTestData === "string" ? JSON.parse(c.abTestData) : c.abTestData) : null;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to campaigns
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{c.name}</h1>
          <p className="text-gray-400 mt-1">{c.subject} · {c.totalRecipients} recipients</p>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-xs font-medium",
          c.status === "SENT" ? "bg-green-500/10 text-green-400" :
          c.status === "SENDING" ? "bg-blue-500/10 text-blue-400" :
          c.status === "SCHEDULED" ? "bg-yellow-500/10 text-yellow-400" :
          "bg-gray-500/10 text-gray-400"
        )}>{c.status}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { icon: Mail, label: "Delivered", value: `${c.deliveredCount}/${c.totalRecipients}`, color: "text-green-400" },
          { icon: Eye, label: "Open Rate", value: `${openRate}%`, color: "text-violet-400" },
          { icon: MousePointerClick, label: "Click Rate", value: `${clickRate}%`, color: "text-amber-400" },
          { icon: Clock, label: "Failed", value: c.failedCount, color: "text-red-400" },
          { icon: BarChart3, label: "Total Events", value: recentEvents?.length || 0, color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Time-Series Chart */}
      {timeline.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-3">Engagement Timeline</h3>
          <div className="flex items-end gap-1.5 h-32">
            {timeline.map(([hour, counts]) => (
              <div key={hour} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                <div className="w-full flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-t bg-violet-500/60 transition-all" style={{ height: `${(counts.opens / maxCount) * 100}%` }} title={`${hour}: ${counts.opens} opens`} />
                  <div className="w-full rounded-t bg-amber-500/60 transition-all" style={{ height: `${(counts.clicks / maxCount) * 100}%` }} title={`${hour}: ${counts.clicks} clicks`} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-violet-500/60" /> Opens</span>
            <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded bg-amber-500/60" /> Clicks</span>
          </div>
        </div>
      )}

      {/* A/B Test Results */}
      {abData && abData.status !== "PENDING" && (
        <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">A/B Test Results</h3>
            </div>
            {(abData.status === "TESTING" || abData.status === "PENDING") && (
              <button onClick={triggerAbCheck} disabled={runningAbCheck}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-medium hover:bg-purple-500/30 disabled:opacity-50"
              >
                {runningAbCheck ? <Loader2 className="w-3 h-3 animate-spin" /> : <Target className="w-3 h-3" />}
                Check Winner
              </button>
            )}
          </div>
          {abData.winner && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-3">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-white font-medium">Winner: Variant {abData.winner}</span>
              <span className="text-xs text-gray-400">({abData.aOpens} opens A · {abData.bOpens} opens B)</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Variant A Opens</p>
              <p className="text-lg font-bold text-white">{abData.aOpens} <span className="text-xs text-gray-500">/ {abData.aSent}</span></p>
              <p className="text-xs text-gray-500">{abData.aSent > 0 ? Math.round((abData.aOpens / abData.aSent) * 100) : 0}%</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Variant B Opens</p>
              <p className="text-lg font-bold text-white">{abData.bOpens} <span className="text-xs text-gray-500">/ {abData.bSent}</span></p>
              <p className="text-xs text-gray-500">{abData.bSent > 0 ? Math.round((abData.bOpens / abData.bSent) * 100) : 0}%</p>
            </div>
          </div>
          {abData.holdoutLeadIds?.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">{abData.holdoutLeadIds.length} leads in holdout</p>
          )}
        </div>
      )}

      {/* Recent Events */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Recent Events ({recentEvents?.length || 0})</h3>
        {(!recentEvents || recentEvents.length === 0) ? (
          <div className="text-center py-8 rounded-xl bg-white/5 border border-white/10">
            <Eye className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No tracking events yet</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recentEvents.slice(0, 50).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                {e.event === "open" ? <Eye className="w-3.5 h-3.5 text-violet-400" /> : <MousePointerClick className="w-3.5 h-3.5 text-amber-400" />}
                <span className="text-xs text-gray-300">{e.event === "open" ? "Opened" : "Clicked"}</span>
                {e.url && <span className="text-xs text-gray-500 truncate max-w-[200px]">{e.url}</span>}
                <span className="text-xs text-gray-500 ml-auto">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

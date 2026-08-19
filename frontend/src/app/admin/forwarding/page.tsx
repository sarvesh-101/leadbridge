"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  Send, Smartphone, Mail, TrendingUp, Activity,
  Users, Phone, Calendar, CheckCircle2, XCircle,
  Loader2, RefreshCw, ArrowRight, Zap,
} from "lucide-react";

interface ForwardingAnalytics {
  summary: {
    totalForwarded: number;
    forwardedToday: number;
    forwardedThisMonth: number;
    forwardedConverted: number;
    forwardedBooked: number;
    forwardedCalled: number;
    conversionRate: number;
    bookingRate: number;
  };
  bySourceFull: Record<string, number>;
  byPortal: Array<{ portal: string; count: number }>;
  statusFunnel: Array<{ status: string; count: number }>;
  recentLeads: Array<{
    id: string;
    name: string;
    phone: string;
    source: string;
    portalSource: string | null;
    status: string;
    createdAt: string;
    broker: string;
  }>;
}

const SOURCE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  sms_forward: { label: "SMS Forward", icon: Smartphone, color: "text-blue-400" },
  email_forward: { label: "Email Forward", icon: Mail, color: "text-green-400" },
  test_forward: { label: "Test", icon: Send, color: "text-purple-400" },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
  CALLING: "text-blue-400 border-blue-500/20 bg-blue-500/10",
  BOOKED: "text-green-400 border-green-500/20 bg-green-500/10",
  VISITED: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  CONVERTED: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10",
  COLD: "text-[#9FB0A6] border-gray-500/20 bg-gray-500/10",
  NO_SHOW: "text-red-400 border-red-500/20 bg-red-500/10",
  FOLLOWUP_D1: "text-orange-400 border-orange-500/20 bg-orange-500/10",
  FOLLOWUP_D2: "text-orange-400 border-orange-500/20 bg-orange-500/10",
  FOLLOWUP_D3: "text-orange-400 border-orange-500/20 bg-orange-500/10",
};

function StatCard({ icon: Icon, label, value, sub, color, loading }: {
  icon: any; label: string; value: string | number; sub: string; color: string; loading?: boolean;
}) {
  return (
    <motion.div className="p-4 rounded-xl app-card">
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-12 bg-white/[0.06] rounded" />
          <div className="h-3 w-20 bg-white/[0.06] rounded" />
        </div>
      ) : (
        <>
          <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", color)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="text-xl font-bold text-[#F0F7F3]">{value}</div>
          <div className="text-xs text-[#9FB0A6]">{label}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
        </>
      )}
    </motion.div>
  );
}

export default function AdminForwardingPage() {
  const [data, setData] = useState<ForwardingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ForwardingAnalytics>("/admin/forwarding/analytics");
      setData(res);
    } catch (err: any) {
      console.error("Failed to load forwarding analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalBySource = data?.bySourceFull || {};
  const smsCount = totalBySource["sms_forward"] || 0;
  const emailCount = totalBySource["email_forward"] || 0;
  const testCount = totalBySource["test_forward"] || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F7F3]">Lead Forwarding Analytics</h1>
          <p className="text-[#9FB0A6] mt-1">Leads created via SMS/email forwarding — portal breakdown & conversion</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6] transition-colors" title="Refresh">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Send} label="Total Forwarded" value={data?.summary.totalForwarded ?? "—"} sub={`${data?.summary.forwardedToday ?? 0} today`} color="from-blue-500 to-blue-600" loading={loading} />
        <StatCard icon={Smartphone} label="SMS Forwarded" value={smsCount} sub={`${emailCount} via email · ${testCount} test`} color="from-violet-500 to-violet-600" loading={loading} />
        <StatCard icon={Phone} label="Calls Made" value={data?.summary.forwardedCalled ?? "—"} sub={`${data?.summary.forwardedBooked ?? 0} booked visits`} color="from-amber-500 to-amber-600" loading={loading} />
        <StatCard icon={TrendingUp} label="Conversion Rate" value={data?.summary.conversionRate != null ? `${data.summary.conversionRate}%` : "—"} sub={`${data?.summary.forwardedConverted ?? 0} converted`} color="from-emerald-500 to-emerald-600" loading={loading} />
      </div>

      {/* Portal Source Breakdown & Status Funnel */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Portal Source Breakdown */}
        <motion.div className="p-5 rounded-xl app-card">
          <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#6FE3B0]" />
            Portal Source Breakdown
          </h2>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-[#101713] rounded" />)}
            </div>
          ) : data?.byPortal && data.byPortal.length > 0 ? (
            <div className="space-y-2">
              {data.byPortal.map((item, i) => {
                const maxCount = Math.max(...data.byPortal.map(p => p.count));
                const pct = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
                const colors = [
                  "from-[#1B4332] to-[#1B4332]/60",
                  "from-[#34D399] to-[#34D399]/60",
                  "from-[#E11D48] to-[#E11D48]/60",
                  "from-[#B8860B] to-[#B8860B]/60",
                  "from-[#8B5CF6] to-[#8B5CF6]/60",
                  "from-[#EC4899] to-[#EC4899]/60",
                ];
                return (
                  <div key={item.portal} className="flex items-center gap-3">
                    <span className="text-xs text-[#9FB0A6] w-24 truncate shrink-0">{item.portal}</span>
                    <div className="flex-1 h-6 rounded-md bg-[#101713] overflow-hidden">
                      <div className={cn("h-full rounded-md bg-gradient-to-r", colors[i % colors.length])}
                        style={{ width: `${pct}%`, minWidth: item.count > 0 ? "24px" : "0" }} />
                    </div>
                    <span className="text-xs font-medium text-[#F0F7F3] w-8 text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Send className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-[#9FB0A6]">No forwarded leads yet</p>
              <p className="text-xs text-gray-600 mt-1">Leads will appear here once brokers start forwarding</p>
            </div>
          )}
        </motion.div>

        {/* Status Funnel */}
        <motion.div className="p-5 rounded-xl app-card">
          <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#34D399]" />
            Conversion Funnel
          </h2>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 bg-[#101713] rounded" />)}
            </div>
          ) : data?.statusFunnel && data.statusFunnel.length > 0 ? (
            <div className="space-y-2">
              {data.statusFunnel
                .sort((a, b) => b.count - a.count)
                .map((item) => {
                  const maxCount = Math.max(...data.statusFunnel.map(s => s.count));
                  const pct = maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0;
                  return (
                    <div key={item.status} className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded border w-20 text-center shrink-0",
                        STATUS_COLORS[item.status] || "text-[#9FB0A6] border-gray-500/20 bg-gray-500/10"
                      )}>
                        {item.status}
                      </span>
                      <div className="flex-1 h-6 rounded-md bg-[#101713] overflow-hidden">
                        <div className="h-full rounded-md bg-gradient-to-r from-[#34D399] to-[#34D399]/60"
                          style={{ width: `${pct}%`, minWidth: item.count > 0 ? "24px" : "0" }} />
                      </div>
                      <span className="text-xs font-medium text-[#F0F7F3] w-8 text-right">{item.count}</span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-[#9FB0A6]">No funnel data yet</p>
            </div>
          )}

          {/* Quick conversion stats */}
          {!loading && data && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="p-2 rounded-lg bg-black/20 border border-white/10 text-center">
                <div className="text-xs font-bold text-[#F0F7F3]">{data.summary.forwardedCalled}</div>
                <div className="text-[10px] text-[#9FB0A6]">Called</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20 border border-white/10 text-center">
                <div className="text-xs font-bold text-green-400">{data.summary.forwardedBooked}</div>
                <div className="text-[10px] text-[#9FB0A6]">Booked</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20 border border-white/10 text-center">
                <div className="text-xs font-bold text-emerald-400">{data.summary.forwardedConverted}</div>
                <div className="text-[10px] text-[#9FB0A6]">Converted</div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Forwarding Leads Table */}
      <motion.div className="p-5 rounded-xl app-card">
        <h2 className="text-sm font-semibold text-[#F0F7F3] mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#6FE3B0]" />
          Recent Forwarded Leads
          {!loading && data && (
            <span className="text-[11px] text-[#9FB0A6] font-normal ml-2">({data.recentLeads.length} total)</span>
          )}
        </h2>

        <ErrorBoundary fallback={
          <div className="p-8 text-center">
            <p className="text-sm text-red-400">Failed to load leads table</p>
          </div>
        }>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex gap-4 p-3 rounded-lg bg-[#101713]">
                  <div className="h-4 w-24 bg-white/[0.06] rounded" />
                  <div className="h-4 w-32 bg-white/[0.06] rounded" />
                  <div className="h-4 w-20 bg-white/[0.06] rounded" />
                  <div className="h-4 w-16 bg-white/[0.06] rounded" />
                  <div className="h-4 w-24 bg-white/[0.06] rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : data?.recentLeads && data.recentLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-[11px] text-[#9FB0A6] font-medium py-2 px-2">Name</th>
                    <th className="text-left text-[11px] text-[#9FB0A6] font-medium py-2 px-2">Broker</th>
                    <th className="text-left text-[11px] text-[#9FB0A6] font-medium py-2 px-2">Source</th>
                    <th className="text-left text-[11px] text-[#9FB0A6] font-medium py-2 px-2">Portal</th>
                    <th className="text-left text-[11px] text-[#9FB0A6] font-medium py-2 px-2">Status</th>
                    <th className="text-right text-[11px] text-[#9FB0A6] font-medium py-2 px-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLeads.map((lead, i) => {
                    const sourceInfo = SOURCE_LABELS[lead.source] || { label: lead.source, icon: Send, color: "text-[#9FB0A6]" };
                    const SourceIcon = sourceInfo.icon;
                    return (
                      <motion.tr key={lead.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-white/10 hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-2.5 px-2">
                          <span className="text-[#F0F7F3] font-medium text-[13px]">{lead.name}</span>
                          <span className="text-[#9FB0A6] text-[11px] ml-2">{lead.phone}</span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-[#9FB0A6] text-[12px]">{lead.broker}</span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={cn("inline-flex items-center gap-1 text-[11px]", sourceInfo.color)}>
                            <SourceIcon className="w-3 h-3" />
                            {sourceInfo.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="text-[11px] text-[#9FB0A6]">
                            {lead.portalSource || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full border",
                            STATUS_COLORS[lead.status] || "text-[#9FB0A6] border-gray-500/20 bg-gray-500/10"
                          )}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="text-[11px] text-[#9FB0A6]">
                            {new Date(lead.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-10 text-center">
              <Send className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-[#9FB0A6]">No forwarded leads yet</p>
              <p className="text-xs text-gray-600 mt-1">
                Once brokers start forwarding SMS/emails, leads will appear here
              </p>
            </div>
          )}
        </ErrorBoundary>
      </motion.div>
    </div>
  );
}

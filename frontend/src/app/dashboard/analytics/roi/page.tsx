"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { TrendingUp, DollarSign, Target, ArrowUp, ArrowDown, Minus, Loader2, Edit3 } from "lucide-react";

export default function ROIPage() {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [costInput, setCostInput] = useState("");

  useEffect(() => { loadROI(); }, []);

  async function loadROI() {
    try {
      const res = await api.get("/analytics/roi");
      setSources(res.sources || []);
      setSummary(res.summary);
    } catch (err: any) {
      toast.error("Failed to load ROI analytics");
    } finally {
      setLoading(false);
    }
  }

  async function updateCost(source: string) {
    const cost = parseFloat(costInput);
    if (isNaN(cost) || cost < 0) return toast.error("Enter a valid cost");
    try {
      await api.post("/analytics/roi/cost", { source, costPerLead: cost });
      toast.success(`Cost updated for ${source}`);
      setEditingSource(null);
      await loadROI();
    } catch (err: any) {
      toast.error(err.message || "Failed to update cost");
    }
  }

  const trendIcon = (trend: string) => {
    if (trend === "up") return <ArrowUp className="w-3.5 h-3.5 text-green-400" />;
    if (trend === "down") return <ArrowDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-gray-500" />;
  };

  const maxLeads = Math.max(...sources.map((s: any) => s.totalLeads), 1);
  const maxConvRate = Math.max(...sources.map((s: any) => s.conversionRate), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Lead Source ROI</h1>
        <p className="text-gray-400 mt-1">Cost-per-lead and conversion analytics by source</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}
          </>
        ) : (
          <>
            {[
              { icon: DollarSign, label: "Total Spend", value: `₹${summary?.totalSpend?.toLocaleString() || 0}`, color: "from-blue-500 to-blue-600" },
              { icon: TrendingUp, label: "Avg CPL", value: `₹${summary?.avgCpl || 0}`, color: "from-purple-500 to-purple-600" },
              { icon: Target, label: "Best Source", value: summary?.bestSource || "—", color: "from-green-500 to-green-600" },
              { icon: TrendingUp, label: "Sources Tracked", value: sources.length, color: "from-orange-500 to-orange-600" },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2", s.color)}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-lg font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Source ROI Table */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/10 animate-pulse" />)}</div>
      ) : sources.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No source data yet</h3>
          <p className="text-sm text-gray-500">Leads will appear here once they start coming in</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="hidden lg:grid grid-cols-7 gap-4 px-4 py-2 text-xs text-gray-500 font-medium">
            <span>Source</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Conv. Rate</span>
            <span className="text-right">Cost/Lead</span>
            <span className="text-right">Cost/Conv.</span>
            <span className="text-right">Total Cost</span>
            <span className="text-right">Trend</span>
          </div>

          {sources.map((src: any, i: number) => (
            <motion.div key={src.source} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="grid grid-cols-2 lg:grid-cols-7 gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all items-center"
            >
              <div className="lg:col-span-1">
                <span className="text-sm font-medium text-white capitalize">{src.source}</span>
              </div>
              <div className="text-right">
                <div className="text-sm text-white font-medium">{src.totalLeads}</div>
                <div className="text-[10px] text-gray-600">leads</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-white font-medium">{src.conversionRate}%</div>
                <div className="w-full h-1 rounded-full bg-white/5 mt-1 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${(src.conversionRate / maxConvRate) * 100}%` }} />
                </div>
              </div>
              <div className="text-right">
                {editingSource === src.source ? (
                  <div className="flex items-center gap-1 justify-end">
                    <input type="number" value={costInput} onChange={(e) => setCostInput(e.target.value)}
                      className="w-20 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white text-right"
                      autoFocus
                    />
                    <button onClick={() => updateCost(src.source)} className="p-1 text-green-400 text-xs">OK</button>
                    <button onClick={() => setEditingSource(null)} className="p-1 text-gray-500 text-xs">X</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-sm text-white">₹{src.costPerLead}</span>
                    <button onClick={() => { setEditingSource(src.source); setCostInput(String(src.costPerLead)); }}
                      className="p-0.5 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="text-right text-sm text-gray-300">₹{src.costPerConversion}</div>
              <div className="text-right text-sm text-gray-300">₹{src.totalCost?.toLocaleString()}</div>
              <div className="flex items-center justify-end">
                {trendIcon(src.trend)}
                <span className="text-xs text-gray-500 ml-1 capitalize">{src.trend}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

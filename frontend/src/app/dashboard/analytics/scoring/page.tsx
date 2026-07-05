"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  BrainCircuit, TrendingUp, Target, AlertTriangle, Loader2,
  ArrowUp, ArrowDown, BarChart3, PieChart, RefreshCw,
  CheckCircle2, XCircle, HelpCircle,
} from "lucide-react";

interface CalibrationBand {
  scoreBand: string;
  leads: number;
  converted: number;
  rate: number;
}

interface FactorPerformance {
  factor: string;
  avgScore: number;
  conversionRate: number;
}

interface AccuracyData {
  totalLeads: number;
  highScoreCount: number;
  convertedFromHighScore: number;
  accuracy: number;
  precision: number;
  recall: number;
  calibration: CalibrationBand[];
  topFactorPerformance: FactorPerformance[];
}

interface RecalibrationData {
  currentWeights: Record<string, number>;
  recommendedWeights: Record<string, number>;
  changes: Record<string, { from: number; to: number; reason: string }>;
  confidence: string;
  requiresMoreData: boolean;
}

const FACTOR_LABELS: Record<string, string> = {
  source: "Source Quality",
  latency: "Response Speed",
  timeline: "Timeline Urgency",
  budget: "Budget Fit",
  propertyType: "Property Match",
  callHour: "Call Timing",
  territory: "Territory Match",
  sentiment: "Call Sentiment",
};

export default function ScoringAnalyticsPage() {
  const [accuracyData, setAccuracyData] = useState<AccuracyData | null>(null);
  const [recalibration, setRecalibration] = useState<RecalibrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalibrating, setRecalibrating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [accuracy, recal] = await Promise.all([
        api.get<AccuracyData>("/scoring/accuracy"),
        api.get<RecalibrationData>("/scoring/recalibrate"),
      ]);
      setAccuracyData(accuracy);
      setRecalibration(recal);
    } catch (err: any) {
      toast.error("Failed to load scoring data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-white/10 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl" />)}
          </div>
          <div className="h-64 bg-white/5 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Scoring Analytics</h1>
          <p className="text-gray-400 mt-1">
            Monitor scoring accuracy and refine lead prediction weights
          </p>
        </div>
        <button onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Accuracy Overview */}
      {accuracyData && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Scored Leads", value: accuracyData.totalLeads, icon: BrainCircuit, color: "text-blue-400" },
              { label: "High Score", value: accuracyData.highScoreCount, icon: TrendingUp, color: "text-green-400" },
              { label: "Predicted Correctly", value: accuracyData.convertedFromHighScore, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Precision", value: `${accuracyData.precision}%`, icon: Target, color: accuracyData.precision >= 70 ? "text-green-400" : "text-amber-400" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <s.icon className={cn("w-5 h-5 mb-1", s.color)} />
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Calibration Curve */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-white/5 border border-white/10"
          >
            <h2 className="text-sm font-semibold text-white mb-4">Score Calibration</h2>
            <p className="text-xs text-gray-500 mb-4">
              Higher score bands should have higher conversion rates. A well-calibrated model shows a clear upward staircase.
            </p>
            <div className="space-y-3">
              {accuracyData.calibration.map((band) => (
                <div key={band.scoreBand}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">Score {band.scoreBand}</span>
                    <span className="text-gray-500">{band.leads} leads · {band.converted} converted</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          band.rate >= 60 ? "bg-green-500" :
                          band.rate >= 30 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${band.rate}%` }}
                      />
                    </div>
                    <span className={cn(
                      "text-xs font-mono w-12 text-right",
                      band.rate >= 60 ? "text-green-400" :
                      band.rate >= 30 ? "text-amber-400" : "text-red-400"
                    )}>
                      {band.rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Factor Performance */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-xl bg-white/5 border border-white/10"
          >
            <h2 className="text-sm font-semibold text-white mb-4">Factor Performance Analysis</h2>
            <p className="text-xs text-gray-500 mb-4">
              How each scoring factor correlates with actual conversion rates.
            </p>
            <div className="space-y-2">
              {accuracyData.topFactorPerformance.map((fp) => (
                <div key={fp.factor}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex-1">
                    <div className="text-sm text-white">{FACTOR_LABELS[fp.factor] || fp.factor}</div>
                    <div className="text-xs text-gray-500">Avg score: {fp.avgScore}</div>
                  </div>
                  <div className={cn(
                    "text-sm font-mono font-medium",
                    fp.conversionRate >= 40 ? "text-green-400" :
                    fp.conversionRate >= 20 ? "text-amber-400" : "text-red-400"
                  )}>
                    {fp.conversionRate}% conv.
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {/* Weight Recalibration */}
      {recalibration && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-xl bg-white/5 border border-white/10"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Weight Optimization</h2>
              <p className="text-xs text-gray-500 mt-1">
                {recalibration.requiresMoreData
                  ? "Need at least 20 scored leads with outcomes before recalibrating."
                  : `Recalibration confidence: ${recalibration.confidence}`}
              </p>
            </div>
            {recalibration.confidence !== "low" && !recalibration.requiresMoreData && (
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                recalibration.confidence === "high" ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"
              )}>
                {recalibration.confidence} confidence
              </span>
            )}
          </div>

          {recalibration.requiresMoreData ? (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <p className="text-sm text-amber-300">Not enough data yet. Continue scoring leads to enable weight optimization.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(recalibration.currentWeights).map(([factor, currentWeight]) => {
                const recommended = recalibration.recommendedWeights[factor];
                const change = recalibration.changes[factor];
                const changed = change && Math.abs(change.to - change.from) > 0.02;

                return (
                  <div key={factor}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      changed ? "bg-[#4F6EF7]/5 border-[#4F6EF7]/20" : "bg-white/5 border-white/10"
                    )}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{FACTOR_LABELS[factor] || factor}</span>
                        {changed && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[#4F6EF7]/10 text-[#4F6EF7]">
                            Recommended change
                          </span>
                        )}
                      </div>
                      {change && (
                        <p className="text-xs text-gray-500 mt-0.5">{change.reason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-mono">
                      <span className="text-gray-400">{Math.round(currentWeight * 100)}%</span>
                      {changed && (
                        <>
                          <ArrowRight className="w-3.5 h-3.5 text-[#4F6EF7]" />
                          <span className="text-[#4F6EF7] font-semibold">{Math.round(recommended * 100)}%</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  );
}

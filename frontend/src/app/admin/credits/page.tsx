"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, TrendingDown, Users, Phone, 
  Calendar, RefreshCw, AlertTriangle, Loader2, Plus,
  X, Zap, BarChart3, Wallet, ArrowUp, ArrowDown,
} from "lucide-react";

interface CreditOverview {
  credit: {
    billingMonth: string;
    totalMinutesPurchased: number;
    minutesUsed: number;
    minutesRemaining: number;
    remainingPercent: number;
    totalCost: number;
    effectiveCostPerMinute: number;
    costPerMinute: number;
    costPerPhoneMonthly: number;
    phoneNumbersActive: number;
    lastRechargedAt: string | null;
    alertThresholdPercent: number;
    needsAlert: boolean;
  };
  recentTransactions: Array<{
    id: string;
    type: "PURCHASE" | "CONSUME" | "OVERRIDE";
    amount: number;
    minutes: number;
    description: string | null;
    clientId: string | null;
    createdAt: string;
  }>;
}

interface BrokerCost {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  plan: string;
  planStatus: string;
  callsUsed: number;
  callsLimit: number;
  costIncurred: number;
  revenueGenerated: number;
  profit: number;
  profitMarginPercent: number;
  costPerCall: number;
  phoneSetupStatus: string;
  joinedAt: string;
}

export default function AdminCreditsPage() {
  const [overview, setOverview] = useState<CreditOverview | null>(null);
  const [brokers, setBrokers] = useState<BrokerCost[]>([]);
  const [brokerSummary, setBrokerSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [brokerLoading, setBrokerLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpMinutes, setTopUpMinutes] = useState("");
  const [topUpCost, setTopUpCost] = useState("");
  const [topUpDesc, setTopUpDesc] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const data = await api.get<CreditOverview>("/admin/credits/overview");
      setOverview(data);
    } catch {
      toast.error("Failed to load credit overview");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBrokers = useCallback(async () => {
    setBrokerLoading(true);
    try {
      const data = await api.get<{ brokers: BrokerCost[]; summary: any }>("/admin/credits/brokers");
      setBrokers(data.brokers);
      setBrokerSummary(data.summary);
    } catch {
      toast.error("Failed to load broker costs");
    } finally {
      setBrokerLoading(false);
    }
  }, []);

  useEffect(() => { 
    loadOverview();
    loadBrokers();
  }, [loadOverview, loadBrokers]);

  async function handleTopUp() {
    const minutes = parseInt(topUpMinutes);
    const cost = parseFloat(topUpCost);
    if (!minutes || minutes < 1 || isNaN(cost) || cost < 0) {
      toast.error("Enter valid minutes and cost");
      return;
    }
    setTopUpLoading(true);
    try {
      await api.post("/admin/credits/top-up", {
        minutes,
        totalCost: cost,
        description: topUpDesc || undefined,
      });
      toast.success(`Topped up ${minutes} minutes for ₹${cost.toLocaleString()}`);
      setShowTopUp(false);
      setTopUpMinutes("");
      setTopUpCost("");
      setTopUpDesc("");
      await loadOverview();
    } catch (err: any) {
      toast.error(err.message || "Failed to top up");
    } finally {
      setTopUpLoading(false);
    }
  }

  const credit = overview?.credit;

  // Format money helper
  const fm = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Platform Credits & Costs</h1>
          <p className="text-ink-soft mt-1">Track OmniDimension credit consumption and broker profitability</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadOverview(); loadBrokers(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl app-card app-card-hover text-ink-soft text-sm hover:bg-white/[0.06] transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button onClick={() => setShowTopUp(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" /> Top Up Credits
          </button>
        </div>
      </div>

      {/* Credit Health Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 rounded-xl app-card animate-pulse" />
          ))}
        </div>
      ) : credit ? (
        <>
          {/* Low Credit Warning */}
          {credit.needsAlert && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20"
            >
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">Credits Running Low</p>
                <p className="text-xs text-warning/80 mt-0.5">
                  Only {credit.minutesRemaining} min remaining ({credit.remainingPercent}% of {credit.totalMinutesPurchased} min purchased).
                  Consider topping up.
                </p>
              </div>
              <button onClick={() => setShowTopUp(true)}
                className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-all"
              >
                Top Up Now
              </button>
            </motion.div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl app-card">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-ink-soft">Minutes Purchased</span>
              </div>
              <div className="text-xl font-bold text-ink">{credit.totalMinutesPurchased.toLocaleString()}</div>
              <p className="text-[11px] text-ink-soft mt-1">
                Month: {credit.billingMonth}
              </p>
            </div>
            <div className="p-4 rounded-xl app-card">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-warning" />
                <span className="text-xs text-ink-soft">Minutes Used</span>
              </div>
              <div className="text-xl font-bold text-ink">{credit.minutesUsed.toLocaleString()}</div>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full",
                      credit.remainingPercent > 50 ? "bg-success" : 
                      credit.remainingPercent > 20 ? "bg-warning" : "bg-danger"
                    )}
                    style={{ width: `${credit.totalMinutesPurchased > 0 ? (credit.minutesUsed / credit.totalMinutesPurchased) * 100 : 0}%` }}
                  />
                </div>
                <span className={cn(
                  "text-[11px] font-medium",
                  credit.remainingPercent > 50 ? "text-success" : 
                  credit.remainingPercent > 20 ? "text-warning" : "text-danger"
                )}>
                  {credit.remainingPercent}% left
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl app-card">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-success" />
                <span className="text-xs text-ink-soft">Total Cost</span>
              </div>
              <div className="text-xl font-bold text-ink">₹{fm(credit.totalCost)}</div>
              <p className="text-[11px] text-ink-soft mt-1">@ ₹{credit.effectiveCostPerMinute}/min avg</p>
            </div>
            <div className="p-4 rounded-xl app-card">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-ink-soft">Phone Numbers</span>
              </div>
              <div className="text-xl font-bold text-ink">{credit.phoneNumbersActive}</div>
              <p className="text-[11px] text-ink-soft mt-1">@ ₹{credit.costPerPhoneMonthly}/mo each</p>
            </div>
          </div>

          {/* Recent Transactions */}
          {overview.recentTransactions.length > 0 && (
            <div className="p-5 rounded-xl app-card">
              <h3 className="text-sm font-semibold text-ink mb-4">Recent Transactions</h3>
              <div className="space-y-2">
                {overview.recentTransactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-canvas">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      tx.type === "PURCHASE" ? "bg-success/20" :
                      tx.type === "CONSUME" ? "bg-warning/20" : "bg-blue-500/20"
                    )}>
                      {tx.type === "PURCHASE" ? (
                        <ArrowUp className="w-4 h-4 text-success" />
                      ) : tx.type === "CONSUME" ? (
                        <ArrowDown className="w-4 h-4 text-warning" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink truncate">{tx.description || `${tx.type} transaction`}</p>
                      <p className="text-[11px] text-ink-soft">
                        {new Date(tx.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-sm font-medium",
                        tx.type === "PURCHASE" ? "text-success" :
                        tx.type === "CONSUME" ? "text-warning" : "text-blue-400"
                      )}>
                        {tx.type === "PURCHASE" ? "+" : tx.type === "CONSUME" ? "-" : "~"}₹{fm(tx.amount)}
                      </p>
                      {tx.minutes > 0 && (
                        <p className="text-[11px] text-ink-soft">{tx.minutes} min</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-8 rounded-xl app-card text-center">
          <Wallet className="w-10 h-10 text-ink-soft mx-auto mb-3" />
          <h3 className="text-base font-semibold text-ink mb-1">No Credit Data Yet</h3>
          <p className="text-sm text-ink-soft mb-4">Top up platform credits to start tracking costs</p>
          <button onClick={() => setShowTopUp(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Credits
          </button>
        </div>
      )}

      {/* Broker Profitability */}
      <div className="p-5 rounded-xl app-card">
        <h3 className="text-sm font-semibold text-ink mb-4">Broker Profitability</h3>

        {brokerSummary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-canvas">
              <p className="text-[11px] text-ink-soft">Total Revenue</p>
              <p className="text-lg font-bold text-success">₹{fm(brokerSummary.totalRevenue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-canvas">
              <p className="text-[11px] text-ink-soft">Total Cost</p>
              <p className="text-lg font-bold text-warning">₹{fm(brokerSummary.totalCost)}</p>
            </div>
            <div className="p-3 rounded-lg bg-canvas">
              <p className="text-[11px] text-ink-soft">Total Profit</p>
              <p className={cn(
                "text-lg font-bold",
                brokerSummary.totalProfit >= 0 ? "text-success" : "text-danger"
              )}>
                {brokerSummary.totalProfit >= 0 ? "+" : ""}₹{fm(brokerSummary.totalProfit)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-canvas">
              <p className="text-[11px] text-ink-soft">Margin</p>
              <p className={cn(
                "text-lg font-bold",
                brokerSummary.overallMarginPercent >= 50 ? "text-success" :
                brokerSummary.overallMarginPercent >= 20 ? "text-warning" : "text-danger"
              )}>
                {brokerSummary.overallMarginPercent}%
              </p>
              <p className="text-[11px] text-ink-soft">
                {brokerSummary.brokersInProfit}/{brokerSummary.totalBrokers} in profit
              </p>
            </div>
          </div>
        )}

        {brokerLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 rounded-lg bg-canvas animate-pulse" />
            ))}
          </div>
        ) : brokers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">Broker</th>
                  <th className="text-right py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">Plan</th>
                  <th className="text-right py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">Calls</th>
                  <th className="text-right py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">Cost</th>
                  <th className="text-right py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">Revenue</th>
                  <th className="text-right py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">Profit</th>
                  <th className="text-right py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">Margin</th>
                  <th className="text-right py-3 px-2 text-ink-soft font-medium text-[11px] uppercase">₹/Call</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => (
                  <tr key={b.id} className="border-b border-line hover:bg-white/[0.06] transition-colors">
                    <td className="py-3 px-2">
                      <div>
                        <p className="text-ink font-medium truncate max-w-[200px]">{b.businessName}</p>
                        <p className="text-[11px] text-ink-soft">{b.ownerName}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        b.plan === "PRO" ? "bg-warning/10 text-warning border border-warning/20" :
                        b.plan === "GROWTH" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                        "bg-neutral-soft/10 text-ink-soft border border-line/20"
                      )}>
                        {b.plan}
                      </span>
                    </td>
                    <td className="text-right py-3 px-2 text-ink">
                      {b.callsUsed}/{b.callsLimit}
                    </td>
                    <td className="text-right py-3 px-2 text-warning">
                      ₹{fm(b.costIncurred)}
                    </td>
                    <td className="text-right py-3 px-2 text-success">
                      ₹{fm(b.revenueGenerated)}
                    </td>
                    <td className={cn(
                      "text-right py-3 px-2 font-medium",
                      b.profit >= 0 ? "text-success" : "text-danger"
                    )}>
                      {b.profit >= 0 ? "+" : ""}₹{fm(b.profit)}
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              b.profitMarginPercent >= 50 ? "bg-success" :
                              b.profitMarginPercent >= 20 ? "bg-warning" : "bg-danger"
                            )}
                            style={{ width: `${Math.max(0, Math.min(100, b.profitMarginPercent))}%` }}
                          />
                        </div>
                        <span className="text-ink text-xs font-mono w-10 text-right">{b.profitMarginPercent}%</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 text-ink-soft">
                      ₹{b.costPerCall}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-soft text-center py-8">No broker data available yet</p>
        )}
      </div>

      {/* Top Up Modal */}
      <AnimatePresence>
        {showTopUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md mx-4 p-6 rounded-2xl app-card"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-ink">Top Up Platform Credits</h2>
                <button onClick={() => setShowTopUp(false)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-ink-soft">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">Minutes Purchased</label>
                  <input value={topUpMinutes} onChange={(e) => setTopUpMinutes(e.target.value)}
                    type="number" min="1" placeholder="e.g., 3571"
                    className="w-full px-4 py-2.5 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/60"
                    autoFocus
                  />
                  <p className="text-[11px] text-ink-soft mt-1">3571 min = 1 OmniDimension Growth Plan</p>
                </div>
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">Total Cost (₹)</label>
                  <input value={topUpCost} onChange={(e) => setTopUpCost(e.target.value)}
                    type="number" min="0" step="0.01" placeholder="e.g., 16600"
                    className="w-full px-4 py-2.5 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/60"
                  />
                  <p className="text-[11px] text-ink-soft mt-1">₹16,600 for OmniDimension Growth Plan</p>
                </div>
                <div>
                  <label className="block text-sm text-ink-soft mb-1.5">Description (optional)</label>
                  <input value={topUpDesc} onChange={(e) => setTopUpDesc(e.target.value)}
                    placeholder="e.g., OmniDimension Growth - July 2026"
                    className="w-full px-4 py-2.5 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/60"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowTopUp(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-line text-ink-soft text-sm font-medium hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
                <button onClick={handleTopUp} disabled={!topUpMinutes || !topUpCost || topUpLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {topUpLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Wallet className="w-4 h-4" /> Add Credits</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

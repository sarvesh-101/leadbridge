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
          <h1 className="text-2xl font-bold text-white">Platform Credits & Costs</h1>
          <p className="text-gray-400 mt-1">Track OmniDimension credit consumption and broker profitability</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadOverview(); loadBrokers(); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-all"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button onClick={() => setShowTopUp(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" /> Top Up Credits
          </button>
        </div>
      </div>

      {/* Credit Health Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : credit ? (
        <>
          {/* Low Credit Warning */}
          {credit.needsAlert && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-300">Credits Running Low</p>
                <p className="text-xs text-amber-400/80 mt-0.5">
                  Only {credit.minutesRemaining} min remaining ({credit.remainingPercent}% of {credit.totalMinutesPurchased} min purchased).
                  Consider topping up.
                </p>
              </div>
              <button onClick={() => setShowTopUp(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-all"
              >
                Top Up Now
              </button>
            </motion.div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-500">Minutes Purchased</span>
              </div>
              <div className="text-xl font-bold text-white">{credit.totalMinutesPurchased.toLocaleString()}</div>
              <p className="text-[11px] text-gray-500 mt-1">
                Month: {credit.billingMonth}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-gray-500">Minutes Used</span>
              </div>
              <div className="text-xl font-bold text-white">{credit.minutesUsed.toLocaleString()}</div>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full",
                      credit.remainingPercent > 50 ? "bg-green-500" : 
                      credit.remainingPercent > 20 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${credit.totalMinutesPurchased > 0 ? (credit.minutesUsed / credit.totalMinutesPurchased) * 100 : 0}%` }}
                  />
                </div>
                <span className={cn(
                  "text-[11px] font-medium",
                  credit.remainingPercent > 50 ? "text-green-400" : 
                  credit.remainingPercent > 20 ? "text-amber-400" : "text-red-400"
                )}>
                  {credit.remainingPercent}% left
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-500">Total Cost</span>
              </div>
              <div className="text-xl font-bold text-white">₹{fm(credit.totalCost)}</div>
              <p className="text-[11px] text-gray-500 mt-1">@ ₹{credit.effectiveCostPerMinute}/min avg</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-500">Phone Numbers</span>
              </div>
              <div className="text-xl font-bold text-white">{credit.phoneNumbersActive}</div>
              <p className="text-[11px] text-gray-500 mt-1">@ ₹{credit.costPerPhoneMonthly}/mo each</p>
            </div>
          </div>

          {/* Recent Transactions */}
          {overview.recentTransactions.length > 0 && (
            <div className="p-5 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">Recent Transactions</h3>
              <div className="space-y-2">
                {overview.recentTransactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      tx.type === "PURCHASE" ? "bg-green-500/20" :
                      tx.type === "CONSUME" ? "bg-amber-500/20" : "bg-blue-500/20"
                    )}>
                      {tx.type === "PURCHASE" ? (
                        <ArrowUp className="w-4 h-4 text-green-400" />
                      ) : tx.type === "CONSUME" ? (
                        <ArrowDown className="w-4 h-4 text-amber-400" />
                      ) : (
                        <RefreshCw className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{tx.description || `${tx.type} transaction`}</p>
                      <p className="text-[11px] text-gray-500">
                        {new Date(tx.createdAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-sm font-medium",
                        tx.type === "PURCHASE" ? "text-green-400" :
                        tx.type === "CONSUME" ? "text-amber-400" : "text-blue-400"
                      )}>
                        {tx.type === "PURCHASE" ? "+" : tx.type === "CONSUME" ? "-" : "~"}₹{fm(tx.amount)}
                      </p>
                      {tx.minutes > 0 && (
                        <p className="text-[11px] text-gray-500">{tx.minutes} min</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
          <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Credit Data Yet</h3>
          <p className="text-sm text-gray-500 mb-4">Top up platform credits to start tracking costs</p>
          <button onClick={() => setShowTopUp(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Credits
          </button>
        </div>
      )}

      {/* Broker Profitability */}
      <div className="p-5 rounded-xl bg-white/5 border border-white/10">
        <h3 className="text-sm font-semibold text-white mb-4">Broker Profitability</h3>

        {brokerSummary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-[11px] text-gray-500">Total Revenue</p>
              <p className="text-lg font-bold text-green-400">₹{fm(brokerSummary.totalRevenue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-[11px] text-gray-500">Total Cost</p>
              <p className="text-lg font-bold text-amber-400">₹{fm(brokerSummary.totalCost)}</p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-[11px] text-gray-500">Total Profit</p>
              <p className={cn(
                "text-lg font-bold",
                brokerSummary.totalProfit >= 0 ? "text-green-400" : "text-red-400"
              )}>
                {brokerSummary.totalProfit >= 0 ? "+" : ""}₹{fm(brokerSummary.totalProfit)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/5">
              <p className="text-[11px] text-gray-500">Margin</p>
              <p className={cn(
                "text-lg font-bold",
                brokerSummary.overallMarginPercent >= 50 ? "text-green-400" :
                brokerSummary.overallMarginPercent >= 20 ? "text-amber-400" : "text-red-400"
              )}>
                {brokerSummary.overallMarginPercent}%
              </p>
              <p className="text-[11px] text-gray-500">
                {brokerSummary.brokersInProfit}/{brokerSummary.totalBrokers} in profit
              </p>
            </div>
          </div>
        )}

        {brokerLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : brokers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Broker</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Plan</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Calls</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Cost</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Revenue</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Profit</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Margin</th>
                  <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">₹/Call</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => (
                  <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2">
                      <div>
                        <p className="text-white font-medium truncate max-w-[200px]">{b.businessName}</p>
                        <p className="text-[11px] text-gray-500">{b.ownerName}</p>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        b.plan === "PRO" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        b.plan === "GROWTH" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                        "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                      )}>
                        {b.plan}
                      </span>
                    </td>
                    <td className="text-right py-3 px-2 text-white">
                      {b.callsUsed}/{b.callsLimit}
                    </td>
                    <td className="text-right py-3 px-2 text-amber-400">
                      ₹{fm(b.costIncurred)}
                    </td>
                    <td className="text-right py-3 px-2 text-green-400">
                      ₹{fm(b.revenueGenerated)}
                    </td>
                    <td className={cn(
                      "text-right py-3 px-2 font-medium",
                      b.profit >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {b.profit >= 0 ? "+" : ""}₹{fm(b.profit)}
                    </td>
                    <td className="text-right py-3 px-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              b.profitMarginPercent >= 50 ? "bg-green-500" :
                              b.profitMarginPercent >= 20 ? "bg-amber-500" : "bg-red-500"
                            )}
                            style={{ width: `${Math.max(0, Math.min(100, b.profitMarginPercent))}%` }}
                          />
                        </div>
                        <span className="text-white text-xs font-mono w-10 text-right">{b.profitMarginPercent}%</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-2 text-gray-400">
                      ₹{b.costPerCall}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No broker data available yet</p>
        )}
      </div>

      {/* Top Up Modal */}
      <AnimatePresence>
        {showTopUp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md mx-4 p-6 rounded-2xl bg-[#111118] border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Top Up Platform Credits</h2>
                <button onClick={() => setShowTopUp(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Minutes Purchased</label>
                  <input value={topUpMinutes} onChange={(e) => setTopUpMinutes(e.target.value)}
                    type="number" min="1" placeholder="e.g., 3571"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-500 mt-1">3571 min = 1 OmniDimension Growth Plan</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Total Cost (₹)</label>
                  <input value={topUpCost} onChange={(e) => setTopUpCost(e.target.value)}
                    type="number" min="0" step="0.01" placeholder="e.g., 16600"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">₹16,600 for OmniDimension Growth Plan</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Description (optional)</label>
                  <input value={topUpDesc} onChange={(e) => setTopUpDesc(e.target.value)}
                    placeholder="e.g., OmniDimension Growth - July 2026"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setShowTopUp(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5"
                >
                  Cancel
                </button>
                <button onClick={handleTopUp} disabled={!topUpMinutes || !topUpCost || topUpLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
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

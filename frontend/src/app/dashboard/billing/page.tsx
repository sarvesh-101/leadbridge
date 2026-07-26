"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Check, Zap, Loader2, ExternalLink, CreditCard, Clock, Shield,
  AlertTriangle, TrendingUp, FileText, Download,
  X, RefreshCw, Calendar, Crown, AlertCircle,
  Bell, Ban,
} from "lucide-react";
import Link from "next/link";

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    price: "₹18,000",
    period: "/month",
    description: "Full qualification + booking automation",
    features: [
      "100 AI calls/month",
      "Full qualification + booking",
      "WhatsApp notifications",
      "3-day follow-up automation",
      "Basic analytics",
    ],
    highlighted: false,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: "₹35,000",
    period: "/month",
    description: "For growing brokerages with dedicated number",
    features: [
      "300 AI calls/month",
      "Full qualification + booking",
      "WhatsApp notifications",
      "3-day follow-up automation",
      "Dedicated calling number",
      "Priority support",
      "Advanced analytics",
    ],
    highlighted: true,
    color: "from-leadflow-500 to-leadflow-accent",
  },
  {
    id: "PRO",
    name: "Pro",
    price: "₹60,000",
    period: "/month",
    description: "For established enterprises with unlimited access",
    features: [
      "Unlimited AI calls",
      "Full qualification + booking",
      "WhatsApp notifications",
      "7-day follow-up automation",
      "Dedicated calling number",
      "White-label option",
      "Dedicated account manager",
    ],
    highlighted: false,
    color: "from-purple-500 to-purple-600",
  },
] as const;

// ─── Usage Alert Config ──────────────────────────────────────
const ALERT_CONFIG: Record<number, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  80: { label: "80% Usage", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: <Bell className="w-4 h-4" /> },
  90: { label: "90% Usage", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: <AlertTriangle className="w-4 h-4" /> },
  100: { label: "Calls Exhausted", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: <Ban className="w-4 h-4" /> },
};

// ─── Dunning Config ─────────────────────────────────────────
const DUNNING_CONFIG: Record<number, { step: string; description: string }> = {
  1: { step: "Step 1/3", description: "Payment reminder sent via email" },
  2: { step: "Step 2/3", description: "Follow-up sent via WhatsApp" },
  3: { step: "Step 3/3", description: "Final notice — account will be deactivated" },
};

interface BillingData {
  plan?: string;
  planStatus?: string;
  trialEndsAt?: string;
  trialStartedAt?: string;
  convertedFromTrialAt?: string;
  razorpaySubId?: string;
  usage: {
    callsThisMonth: number;
    callsLimit: number;
    rolloverCalls: number;
    totalAvailable: number;
    totalRemaining: number;
    usagePercent: number;
  };
  usageAlerts: {
    lastAlertSentAt: string | null;
    currentLevel: number;
    needsAttention: boolean;
  };
  dunning: {
    step: number;
    startedAt: string;
    isActive: boolean;
  } | null;
  paymentUrl?: string;
  subscription?: any;
}

interface InvoiceEntry {
  id: string;
  invoiceNumber: string;
  status: string;
  description: string;
  amount: number;
  totalAmount: number;
  taxableAmount: number;
  gstAmount: number;
  gstPercentage: number;
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  invoicePdfUrl: string | null;
  payments: Array<{ id: string; status: string; amount: number }>;
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [pollingPlan, setPollingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "invoices" | "usage">("plans");

  useEffect(() => {
    loadBilling();
    loadInvoices();
  }, []);

  // Poll for plan change after Razorpay checkout opens in a new tab
  useEffect(() => {
    if (!pollingPlan) return;
    const startPlan = billing?.plan;
    let attempts = 0;
    const maxAttempts = 40;

    const interval = setInterval(async () => {
      attempts++;
      try {
        const data: BillingData = await api.get("/billing");
        if (data.plan !== startPlan) {
          setBilling(data);
          setPollingPlan(null);
          toast.success(`Upgraded to ${data.plan} plan!`);
          clearInterval(interval);
          return;
        }
      } catch { /* retry */ }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPollingPlan(null);
        toast.info("Payment may still be processing. Refresh to see your updated plan.");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingPlan]);

  async function loadBilling() {
    try {
      const data: BillingData = await api.get("/billing");
      setBilling(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoices() {
    try {
      const data = await api.get<{ invoices: InvoiceEntry[] }>("/subscriptions/invoices");
      setInvoices(data.invoices || []);
    } catch { /* ignore */ }
    finally { setInvoicesLoading(false); }
  }

  async function handleUpgrade(plan: string) {
    setUpgrading(plan);
    setError(null);
    try {
      // Try the new subscription endpoint first (FIX #1: creates Razorpay sub)
      const res = await api.post("/subscriptions", {
        planTier: plan,
        billingCycle: "MONTHLY",
      });

      if (res.paymentUrl) {
        // Payment URL from Razorpay — open in new tab
        window.open(res.paymentUrl, "_blank");
        setBilling((prev) => prev ? { ...prev, paymentUrl: res.paymentUrl } : prev);
        setPollingPlan(plan);
        toast.success("Razorpay checkout opened. Waiting for payment confirmation...");
      } else if (res.subscription) {
        await loadBilling();
        toast.success(`Subscribed to ${plan} plan!`);
      } else {
        // Fall back to the legacy upgrade endpoint
        const legacyRes = await api.post("/billing/upgrade", { plan });
        if (legacyRes.subscription?.shortUrl) {
          window.open(legacyRes.subscription.shortUrl, "_blank");
          setPollingPlan(plan);
          toast.success("Razorpay checkout opened. Waiting for payment confirmation...");
        }
      }
    } catch (err: any) {
      setError(err.message || "Upgrade failed");
      toast.error(err.message || "Upgrade failed");
    } finally {
      setUpgrading(null);
    }
  }

  const currentPlan = billing?.plan;
  const isPastDue = billing?.planStatus === "PAST_DUE";
  const isCancelled = billing?.planStatus === "CANCELLED";
  const isTrial = billing?.planStatus === "TRIAL";
  const needsDunning = billing?.dunning?.isActive;

  // Format money
  const fm = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-gray-400 mt-1">Manage your subscription, usage, and invoices</p>
      </div>

      {/* ─── Alerts Section ─────────────────────────────────── */}
      <AnimatePresence>
        {/* Trial Conversion Alert */}
        {billing?.convertedFromTrialAt && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20"
          >
            <TrendingUp className="w-5 h-5 text-green-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-300">Trial Converted!</p>
              <p className="text-xs text-green-400/70 mt-0.5">
                Converted from trial on {new Date(billing.convertedFromTrialAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </motion.div>
        )}

        {/* Usage Alert Banner */}
        {billing?.usageAlerts?.needsAttention && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border",
              billing.usageAlerts.currentLevel >= 100 ? "bg-red-500/10 border-red-500/20" :
              billing.usageAlerts.currentLevel >= 90 ? "bg-orange-500/10 border-orange-500/20" :
              "bg-amber-500/10 border-amber-500/20"
            )}
          >
            {billing.usageAlerts.currentLevel >= 100 ? (
              <Ban className="w-5 h-5 text-red-400 shrink-0" />
            ) : billing.usageAlerts.currentLevel >= 90 ? (
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
            ) : (
              <Bell className="w-5 h-5 text-amber-400 shrink-0" />
            )}
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium",
                billing.usageAlerts.currentLevel >= 100 ? "text-red-300" :
                billing.usageAlerts.currentLevel >= 90 ? "text-orange-300" : "text-amber-300"
              )}>
                {billing.usageAlerts.currentLevel >= 100
                  ? "Call Credits Exhausted"
                  : `You've used ${billing.usage.usagePercent}% of your calls (${billing.usage.callsThisMonth}/${billing.usage.totalAvailable})`}
              </p>
              <p className={cn("text-xs mt-0.5",
                billing.usageAlerts.currentLevel >= 100 ? "text-red-400/70" : "text-amber-400/70"
              )}>
                {billing.usageAlerts.currentLevel >= 100
                  ? "Purchase an overage pack or upgrade to keep your calls running."
                  : `Consider purchasing additional call credits to avoid interruptions.`}
              </p>
            </div>
            <Link
              href="/dashboard/billing?tab=usage"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 text-gray-200 text-xs font-medium hover:bg-white/20 transition-all"
              onClick={() => setActiveTab("usage")}
            >
              View Usage
            </Link>
          </motion.div>
        )}

        {/* Dunning Alert (PAST_DUE) */}
        {needsDunning && billing?.dunning && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
          >
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-300">
                Payment Required — {DUNNING_CONFIG[billing.dunning.step]?.step || "Action Needed"}
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">
                {DUNNING_CONFIG[billing.dunning.step]?.description || "Your account is past due. Please make a payment to avoid service interruption."}
              </p>
            </div>
            <Link href="/dashboard/billing?tab=plans"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-all"
            >
              Renew Plan
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Current Plan Card ──────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1 }}
        className="p-6 rounded-xl bg-white/5 border border-white/10"
      >
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-32 bg-white/10 rounded" />
            <div className="h-4 w-48 bg-white/10 rounded" />
            <div className="h-2 w-full bg-white/10 rounded" />
          </div>
        ) : billing ? (
          <div className="space-y-4">
            {/* Plan Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  isPastDue || isCancelled
                    ? "bg-red-500/20"
                    : "bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20"
                )}>
                  {isPastDue || isCancelled ? (
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  ) : (
                    <CreditCard className="w-6 h-6 text-leadflow-accent" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-white capitalize">
                      {billing.plan?.toLowerCase() || "—"} Plan
                    </h2>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      isPastDue ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      isCancelled ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" :
                      isTrial ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      "bg-green-500/10 text-green-400 border border-green-500/20"
                    )}>
                      {billing.planStatus || "—"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {isTrial && billing.trialEndsAt ? (
                      <>Trial ends {new Date(billing.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
                    ) : isPastDue ? (
                      <>Payment overdue — renew now to continue service</>
                    ) : isCancelled ? (
                      <>Subscription ended</>
                    ) : billing.trialStartedAt && !billing.convertedFromTrialAt ? (
                      <>Active subscription • Started {new Date(billing.trialStartedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</>
                    ) : (
                      <>Subscription active</>
                    )}
                  </p>
                </div>
              </div>

              {/* Usage right side */}
              <div className="text-right">
                <div className="text-sm text-gray-500">Usage this month</div>
                <div className="text-lg font-bold text-white">
                  {billing.usage.callsThisMonth} / {billing.usage.totalAvailable} calls
                </div>
                <div className="mt-1.5 h-2 w-36 ml-auto rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      billing.usage.usagePercent >= 90 ? "bg-red-500" :
                      billing.usage.usagePercent >= 75 ? "bg-amber-500" :
                      "bg-gradient-to-r from-leadflow-500 to-leadflow-accent"
                    )}
                    style={{ width: `${Math.min(100, billing.usage.usagePercent)}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  {billing.usage.totalRemaining} remaining
                  {billing.usage.rolloverCalls > 0 && ` (${billing.usage.rolloverCalls} rolled over)`}
                </p>
              </div>
            </div>

            {/* Payment URL from new subscription */}
            {billing.paymentUrl && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <ExternalLink className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-300">Payment pending — complete your Razorpay checkout</p>
                </div>
                <a href={billing.paymentUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-all"
                >
                  <ExternalLink className="w-3 h-3" /> Pay Now
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">Unable to load billing info</p>
            <button onClick={loadBilling} className="mt-2 text-xs text-leadflow-accent hover:underline">
              Retry
            </button>
          </div>
        )}
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/20 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Polling indicator */}
      {pollingPlan && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-200">Payment processing...</p>
            <p className="text-xs text-blue-300/70 mt-0.5">
              Waiting for Razorpay confirmation. The page will update automatically once your payment is verified.
            </p>
          </div>
        </div>
      )}

      {/* ─── Tabs: Plans / Invoices / Usage ──────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "plans" as const, label: "Plans", icon: Crown },
          { id: "invoices" as const, label: "Invoices", icon: FileText },
          { id: "usage" as const, label: "Usage & History", icon: Clock },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
              activeTab === tab.id
                ? "bg-leadflow-500/20 text-leadflow-accent border border-leadflow-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ─── PLANS TAB ──────────────────────────────────────── */}
      {activeTab === "plans" && (
        <div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => {
              const isCurrent = currentPlan === plan.id;
              return (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={cn(
                    "relative p-6 rounded-2xl border transition-all duration-300",
                    plan.highlighted
                      ? "bg-gradient-to-b from-leadflow-500/10 to-leadflow-accent/5 border-leadflow-500/30 scale-105"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  )}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-xs font-medium text-white">
                      Most Popular
                    </div>
                  )}

                  <div className="text-center mb-6 mt-2">
                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                    <div className="mt-4">
                      <span className="text-3xl font-bold text-white">{plan.price}</span>
                      <span className="text-sm text-gray-500">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent || upgrading === plan.id}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-300",
                      isCurrent
                        ? "bg-white/5 text-gray-500 cursor-default"
                        : plan.highlighted
                        ? "bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white hover:opacity-90"
                        : "border border-white/10 text-white hover:bg-white/10"
                    )}
                  >
                    {upgrading === plan.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                    ) : isCurrent ? (
                      "Current Plan"
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>

          {/* Payment Info */}
          <div className="mt-6 p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-start gap-4">
              <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-white">Secure payments powered by Razorpay</h3>
                <p className="text-sm text-gray-500 mt-1">
                  All payments are processed securely through Razorpay. GST invoices will be generated and emailed upon payment. 18% GST applies to all plans.
                </p>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 256-bit SSL</span>
                  <span className="flex items-center gap-1"><Check className="w-3 h-3" /> PCI Compliant</span>
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> GST Invoice</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cancel anytime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── INVOICES TAB ───────────────────────────────────── */}
      {activeTab === "invoices" && (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Invoice History</h2>
            <button onClick={loadInvoices} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors">
              <RefreshCw className={cn("w-4 h-4", invoicesLoading && "animate-spin")} />
            </button>
          </div>

          {invoicesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Invoice</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Date</th>
                    <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Amount</th>
                    <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">GST</th>
                    <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Total</th>
                    <th className="text-center py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">Status</th>
                    <th className="text-right py-3 px-2 text-gray-500 font-medium text-[11px] uppercase">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isCredit = inv.amount < 0;
                    const gstAmount = inv.gstAmount || 0;
                    const totalWithGst = inv.totalAmount || inv.amount;
                    return (
                      <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2">
                          <span className="text-white font-medium text-xs">{inv.invoiceNumber}</span>
                          <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{inv.description}</p>
                        </td>
                        <td className="py-3 px-2 text-gray-400 text-xs">
                          {new Date(inv.issueDate).toLocaleDateString("en-IN")}
                        </td>
                        <td className="py-3 px-2 text-right text-gray-300 text-xs">
                          ₹{fm(inv.amount || 0)}
                        </td>
                        <td className="py-3 px-2 text-right text-amber-400 text-xs">
                          +₹{fm(gstAmount)}
                        </td>
                        <td className={cn(
                          "py-3 px-2 text-right font-medium text-xs",
                          isCredit ? "text-red-400" : "text-white"
                        )}>
                          {isCredit ? "-" : ""}₹{fm(Math.abs(totalWithGst))}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-medium",
                            inv.status === "PAID" ? "bg-green-500/10 text-green-400" :
                            inv.status === "SENT" ? "bg-blue-500/10 text-blue-400" :
                            inv.status === "OVERDUE" ? "bg-red-500/10 text-red-400" :
                            inv.status === "REFUNDED" ? "bg-purple-500/10 text-purple-400" :
                            "bg-gray-500/10 text-gray-400"
                          )}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          {inv.invoicePdfUrl ? (
                            <a href={inv.invoicePdfUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-leadflow-500/10 text-leadflow-accent text-[10px] font-medium hover:bg-leadflow-500/20 transition-all"
                            >
                              <Download className="w-3 h-3" /> PDF
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No invoices yet. They'll appear here after your first payment.</p>
            </div>
          )}

          {/* GST Summary */}
          {invoices.filter((i) => i.status === "PAID").length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-white/5">
              <h3 className="text-sm font-medium text-white mb-3">GST Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">Total Paid (excl. GST)</p>
                  <p className="text-sm font-semibold text-white">
                    ₹{fm(invoices.filter(i => i.status === "PAID").reduce((s, i) => s + (i.amount || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Total GST Paid</p>
                  <p className="text-sm font-semibold text-amber-400">
                    ₹{fm(invoices.filter(i => i.status === "PAID").reduce((s, i) => s + (i.gstAmount || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Total Incl. GST</p>
                  <p className="text-sm font-semibold text-white">
                    ₹{fm(invoices.filter(i => i.status === "PAID").reduce((s, i) => s + (i.totalAmount || i.amount || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">GST Rate</p>
                  <p className="text-sm font-semibold text-gray-300">18% (CGST 9% + SGST 9%)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── USAGE & HISTORY TAB ────────────────────────────── */}
      {activeTab === "usage" && (
        <div className="space-y-4">
          {/* Call Usage */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Call Usage</h2>
            {loading ? (
              <div className="h-24 bg-white/5 animate-pulse rounded-lg" />
            ) : billing ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">
                    {billing.usage.callsThisMonth} of {billing.usage.totalAvailable} calls used
                  </span>
                  <span className={cn(
                    "text-sm font-semibold",
                    billing.usage.usagePercent >= 90 ? "text-red-400" :
                    billing.usage.usagePercent >= 75 ? "text-amber-400" : "text-green-400"
                  )}>
                    {billing.usage.usagePercent}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      billing.usage.usagePercent >= 90 ? "bg-red-500" :
                      billing.usage.usagePercent >= 75 ? "bg-amber-500" :
                      "bg-gradient-to-r from-leadflow-500 to-leadflow-accent"
                    )}
                    style={{ width: `${Math.min(100, billing.usage.usagePercent)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Monthly Limit</p>
                    <p className="text-lg font-bold text-white">{billing.usage.callsLimit}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rollover</p>
                    <p className="text-lg font-bold text-leadflow-accent">{billing.usage.rolloverCalls}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Remaining</p>
                    <p className="text-lg font-bold text-green-400">{billing.usage.totalRemaining}</p>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Subscription Status */}
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Subscription Timeline</h2>
            <div className="space-y-3">
              {billing?.trialStartedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Calendar className="w-3 h-3 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Trial Started</p>
                    <p className="text-xs text-gray-500">{new Date(billing.trialStartedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                </div>
              )}
              {billing?.convertedFromTrialAt && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Trial → Paid Conversion</p>
                    <p className="text-xs text-gray-500">{new Date(billing.convertedFromTrialAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                </div>
              )}
              {billing?.usageAlerts?.lastAlertSentAt && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell className="w-3 h-3 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Last Usage Alert</p>
                    <p className="text-xs text-gray-500">{new Date(billing.usageAlerts.lastAlertSentAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      {billing.usageAlerts.currentLevel > 0 && ` at ${billing.usageAlerts.currentLevel}% usage`}</p>
                  </div>
                </div>
              )}
              {billing?.dunning?.startedAt && (
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-red-300">Dunning Started</p>
                    <p className="text-xs text-gray-500">{new Date(billing.dunning.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} — {DUNNING_CONFIG[billing.dunning.step]?.description}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-white">Current Status</p>
                  <p className="text-xs text-gray-500 capitalize">{billing?.planStatus?.toLowerCase() || "Unknown"} • {billing?.plan?.toLowerCase() || "No plan"} plan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Check, Zap, Loader2, ExternalLink, CreditCard, Clock, Shield } from "lucide-react";

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    price: "₹1,999",
    period: "/month",
    description: "For small teams getting started",
    features: [
      "100 calls/month",
      "WhatsApp notifications",
      "Basic analytics",
      "Email support",
      "1 user",
      "Manual lead import",
    ],
    highlighted: false,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: "₹4,999",
    period: "/month",
    description: "For growing brokerages",
    features: [
      "300 calls/month",
      "WhatsApp + SMS notifications",
      "Advanced analytics & funnel",
      "Priority support",
      "3 users",
      "AI lead qualification",
      "Auto follow-up sequences",
      "API access",
    ],
    highlighted: true,
    color: "from-leadflow-500 to-leadflow-accent",
  },
  {
    id: "PRO",
    name: "Pro",
    price: "₹9,999",
    period: "/month",
    description: "For established enterprises",
    features: [
      "Unlimited calls",
      "All notification channels",
      "Full analytics & reports",
      "Dedicated support manager",
      "Unlimited users",
      "AI lead qualification + scoring",
      "Custom workflows",
      "API + webhooks",
      "CSV/Sheets integration",
      "Priority onboarding",
    ],
    highlighted: false,
    color: "from-purple-500 to-purple-600",
  },
] as const;

export default function BillingPage() {
  const [billing, setBilling] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBilling();
  }, []);

  async function loadBilling() {
    try {
      const data = await api.get("/billing");
      setBilling(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: string) {
    setUpgrading(plan);
    setError(null);
    try {
      const res = await api.post("/billing/upgrade", { plan });
      if (res.subscription?.shortUrl) {
        window.open(res.subscription.shortUrl, "_blank");
        toast.success("Redirecting to Razorpay checkout...");
      }
      await loadBilling();
      toast.success(`Upgraded to ${plan} plan!`);
    } catch (err: any) {
      setError(err.message || "Upgrade failed. Please try again.");
      toast.error(err.message || "Upgrade failed");
    } finally {
      setUpgrading(null);
    }
  }

  const currentPlan = billing?.plan;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-gray-400 mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current Plan Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1 }}
        className="p-6 rounded-xl bg-white/5 border border-white/10"
      >
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-5 w-32 bg-white/10 rounded" />
            <div className="h-4 w-48 bg-white/10 rounded" />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-leadflow-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white capitalize">{billing?.plan?.toLowerCase() || "—"} Plan</h2>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full",
                    billing?.planStatus === "ACTIVE" ? "bg-green-500/10 text-green-400" :
                    billing?.planStatus === "TRIAL" ? "bg-blue-500/10 text-blue-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  )}>{billing?.planStatus || "—"}</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {billing?.planStatus === "TRIAL" ? (
                    <>Trial ends {billing?.trialEndsAt ? new Date(billing.trialEndsAt).toLocaleDateString() : "soon"}</>
                  ) : (
                    <>Subscription active</>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Usage this month</div>
              <div className="text-lg font-bold text-white">
                {billing?.usage?.callsThisMonth || 0} / {billing?.usage?.callsLimit || 0} calls
              </div>
              <div className="mt-1 h-2 w-32 ml-auto rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-leadflow-500 to-leadflow-accent"
                  style={{
                    width: `${Math.min(100, ((billing?.usage?.callsThisMonth || 0) / (billing?.usage?.callsLimit || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-6">Choose a plan</h2>
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
      </div>

      {/* Payment Info */}
      <div className="p-6 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-start gap-4">
          <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-white">Secure payments powered by Razorpay</h3>
            <p className="text-sm text-gray-500 mt-1">
              All payments are processed securely through Razorpay. We do not store your payment details.
              Subscriptions can be cancelled at any time. 14-day free trial on all plans.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 256-bit SSL</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3" /> PCI Compliant</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

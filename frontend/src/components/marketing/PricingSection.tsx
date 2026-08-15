"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

// Source of truth: server/src/routes/client/billing.ts → PLAN_DEFINITIONS
// STARTER users 5 / leads 500 / calls 100 · GROWTH 15 / 3000 / 500 ·
// PRO 50 / 50000 / calls 2000 (PRO_MONTHLY_CALL_CAP — Phase 2.2 margin fix;
// NOT unlimited: the platform pays per-minute while PRO is flat ₹60K)
const plans = [
  {
    name: "Starter",
    price: "₹18,000",
    calls: "100 AI calls",
    users: "5",
    leads: "500",
    dedicatedNumber: false,
    followups: "3-day",
    support: "Basic",
    features: [
      "Full qualification + booking",
      "WhatsApp notifications",
      "3-day follow-up automation",
      "Basic analytics",
    ],
    popular: false,
  },
  {
    name: "Growth",
    price: "₹35,000",
    calls: "500 AI calls",
    users: "15",
    leads: "3,000",
    dedicatedNumber: true,
    followups: "3-day",
    support: "Priority",
    features: [
      "Full qualification + booking",
      "WhatsApp notifications",
      "3-day follow-up automation",
      "Dedicated calling number",
      "Priority support",
      "Advanced analytics",
    ],
    popular: true,
  },
  {
    name: "Pro",
    price: "₹60,000",
    calls: "2,000 AI calls",
    users: "50",
    leads: "50,000",
    dedicatedNumber: true,
    followups: "7-day",
    support: "Account manager",
    features: [
      "Full qualification + booking",
      "WhatsApp notifications",
      "7-day follow-up automation",
      "Dedicated calling number",
      "White-label option",
      "Dedicated account manager",
    ],
    popular: false,
  },
];

// Comparison table rows shared with the plan cards (kept in sync with the
// `plans` array above — mirrors PLAN_DEFINITIONS in the server).
const compareRows = [
  { label: "AI calls / month", get: (p: (typeof plans)[number]) => p.calls },
  { label: "Team users", get: (p: (typeof plans)[number]) => p.users },
  { label: "Leads managed / month", get: (p: (typeof plans)[number]) => p.leads },
  { label: "Dedicated calling number", get: (p: (typeof plans)[number]) => p.dedicatedNumber },
  { label: "Follow-up automation", get: (p: (typeof plans)[number]) => p.followups },
  { label: "Support", get: (p: (typeof plans)[number]) => p.support },
  { label: "White-label option", get: (p: (typeof plans)[number]) => p.name === "Pro" },
];

export default function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const cards = sectionRef.current?.querySelectorAll(".pricing-card");
      if (!cards || cards.length < 3) return;

      const st1 = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 70%",
        toggleActions: "play none none none",
        onEnter: () => {
          gsap.fromTo(cards[0], { opacity: 0, x: -100 }, { opacity: 1, x: 0, duration: 0.6 });
          gsap.fromTo(cards[2], { opacity: 0, x: 100 }, { opacity: 1, x: 0, duration: 0.6 });
          gsap.fromTo(cards[1], { opacity: 0, y: 100, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6 });
        },
      });

      kill = () => {
        st1.kill();
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
      };
    };

    init();

    return () => {
      if (kill) kill();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative py-20 lg:py-32 bg-[#0B0D12] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="h1-text text-center mb-16">Simple, transparent pricing</h2>
        <div className="grid md:grid-cols-3 gap-6 items-center">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`pricing-card relative glass-card p-8 transition-all duration-200 ${
                plan.popular
                  ? "border-[#3B82F6] scale-[1.05] z-10"
                  : "hover:translate-y-[-8px] hover:shadow-lg"
              }`}
              style={plan.popular ? { boxShadow: "0 0 20px #3B82F640" } : undefined}
            >
              {plan.popular && (
                <>
                  <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px #3B82F640" }} />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#C9A84C] text-[11px] font-semibold text-black tracking-[0.08em] uppercase whitespace-nowrap">Most Popular</div>
                </>
              )}
              <div className="relative z-1">
                <h3 className="text-[20px] font-semibold text-[#F2F4F8] mb-1">{plan.name}</h3>
                <p className="text-[13px] text-[#8B93A3] mb-1">{plan.calls}</p>
                <div className="text-[36px] font-display font-bold text-[#F2F4F8] mt-6 mb-1">
                  {plan.price}
                  <span className="text-[15px] text-[#8B93A3] font-sans font-normal">/mo</span>
                </div>

                {/* Stat chips: users / leads / dedicated number */}
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-[#14161C] border border-[#272B34] p-2.5 text-center">
                    <p className="text-[16px] font-bold text-[#F2F4F8] leading-none">{plan.users}</p>
                    <p className="text-[10px] text-[#8B93A3] uppercase tracking-wide mt-1.5">Users</p>
                  </div>
                  <div className="rounded-lg bg-[#14161C] border border-[#272B34] p-2.5 text-center">
                    <p className="text-[16px] font-bold text-[#F2F4F8] leading-none">{plan.leads}</p>
                    <p className="text-[10px] text-[#8B93A3] uppercase tracking-wide mt-1.5">Leads</p>
                  </div>
                  <div className="rounded-lg bg-[#14161C] border border-[#272B34] p-2.5 text-center">
                    <p className="text-[16px] font-bold leading-none" style={{ color: plan.dedicatedNumber ? "#10B981" : "#4A4F59" }}>
                      {plan.dedicatedNumber ? "✓" : "—"}
                    </p>
                    <p className="text-[10px] text-[#8B93A3] uppercase tracking-wide mt-1.5">Number</p>
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-[14px] text-[#8B93A3]">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <circle cx="8" cy="8" r="6" fill="#10B981" fillOpacity="0.2" />
                        <path d="M5 8l2 2 4-4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={`block text-center py-3 px-6 rounded-lg mt-8 text-[15px] font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                    plan.popular
                      ? "bg-[#3B82F6] text-white brand-glow"
                      : "border border-[#272B34] text-[#F2F4F8] hover:bg-[#14161C]"
                  }`}
                >
                  Request Your City
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Plan comparison table ─────────────────────────────── */}
        <div className="mt-20">
          <h3 className="text-[20px] font-semibold text-[#F2F4F8] text-center mb-8">Compare every plan</h3>
          <div className="overflow-x-auto rounded-2xl border border-[#272B34] bg-[#14161C]">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-4 gap-0 border-b border-[#272B34]">
              <div className="px-6 py-4">
                <span className="text-[11px] font-semibold text-[#8B93A3] uppercase tracking-[0.08em]">Feature</span>
              </div>
              {plans.map((p) => (
                <div key={p.name} className={`px-6 py-4 ${p.popular ? "bg-[#3B82F6]/5" : ""} ${p.name !== "Starter" ? "border-l border-[#272B34]" : ""}`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${p.popular ? "text-[#3B82F6]" : "text-[#F2F4F8]"}`}>{p.name}</span>
                </div>
              ))}
            </div>
            {compareRows.map((row, i) => (
              <div key={row.label} className={`grid grid-cols-4 gap-0 ${i < compareRows.length - 1 ? "border-b border-[#272B34]" : ""} hover:bg-[#1B1E26] transition-colors`}>
                <div className="px-6 py-4 flex items-center">
                  <span className="text-[13px] text-[#F2F4F8]">{row.label}</span>
                </div>
                {plans.map((p) => {
                  const val = row.get(p);
                  return (
                    <div key={p.name} className={`px-6 py-4 flex items-center gap-2 ${p.popular ? "bg-[#3B82F6]/5" : ""} ${p.name !== "Starter" ? "border-l border-[#272B34]" : ""}`}>
                      {typeof val === "boolean" ? (
                        val ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                            <circle cx="8" cy="8" r="6" fill="#10B981" fillOpacity="0.2" />
                            <path d="M5 8l2 2 4-4" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span className="text-[14px] text-[#4A4F59]">—</span>
                        )
                      ) : (
                        <span className={`text-[13px] font-medium ${p.popular ? "text-[#10B981]" : "text-[#8B93A3]"}`}>{val}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
          <p className="text-center text-[12px] text-[#4A4F59] mt-4">All plans include full qualification, booking automation, WhatsApp notifications, and follow-up sequences. 18% GST applies.</p>
        </div>
      </div>
    </section>
  );
}

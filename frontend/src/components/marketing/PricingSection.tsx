"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { PLANS as PLAN_PAYLOAD } from "@/lib/plans.autogen";

// T1 (V2): single source of truth — server/src/config/plans.ts. This file
// derives every figure from the generated payload (regenerate with
// `cd server && npx tsx scripts/gen-plans.ts` after changing the config).
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
const payloadPlan = (id: string) =>
  PLAN_PAYLOAD.plans.find((p) => p.id === id) as
    | (typeof PLAN_PAYLOAD.plans)[number]
    | undefined;

const plans = ["STARTER", "GROWTH", "PRO"]
  .map(payloadPlan)
  .filter(Boolean)
  .map((p) => ({
    name: p!.name,
    // Display price is ex-GST (doc §1.2); the charged figure is shown as
    // the GST-inclusive value so the billing page and invoices agree.
    price: inr(p!.monthlyExGst),
    incl: inr(p!.monthlyInclGst),
    perLead: inr(p!.pricePerLeadExGst),
    leads: p!.leadsPerMonth.toLocaleString("en-IN"),
    users: String(p!.teamUsers),
    dedicatedNumber: p!.dedicatedNumber,
    followups: p!.followUpDays === 7 ? "7-day" : "3-day",
    support: p!.support,
    popular: p!.id === "GROWTH",
    features: [
      `Up to ${p!.leadsPerMonth.toLocaleString("en-IN")} leads handled per month`,
      "AI call within 60 seconds of every enquiry",
      "Site-visit booking + 24-hour reminders",
      "WhatsApp summary after every call",
      p!.dedicatedNumber ? "Dedicated calling number" : "Shared calling number",
      p!.followUpDays === 7
        ? "7-day follow-up sequence"
        : "3-day follow-up sequence",
      ...(p!.id === "GROWTH" ? ["Priority support"] : []),
      ...(p!.id === "PRO"
        ? [
            "White-label option",
            "Dedicated account manager",
            "Email + SMS campaigns, A/B testing, API access",
          ]
        : []),
    ],
  }));

// Comparison rows — every figure derives from the same generated payload as
// the cards above (single source: server/src/config/plans.ts).
const compareRows = [
  { label: "Leads handled / month", get: (p: (typeof plans)[number]) => p.leads },
  { label: "Price per lead (ex-GST)", get: (p: (typeof plans)[number]) => p.perLead },
  { label: "Team users", get: (p: (typeof plans)[number]) => p.users },
  { label: "Dedicated calling number", get: (p: (typeof plans)[number]) => p.dedicatedNumber },
  { label: "Follow-up sequence", get: (p: (typeof plans)[number]) => p.followups },
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
      gsap.registerPlugin(ScrollTrigger);        const cards = sectionRef.current?.querySelectorAll(".pricing-card");
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
    <section ref={sectionRef} className="relative py-20 lg:py-32 bg-[#0A0F0C] overflow-hidden">
      {/* emerald + gold pricing glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[#34D399] opacity-[0.05] blur-[150px] pointer-events-none" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <h2 className="h1-text text-center mb-16">Simple, transparent pricing</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-center">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`pricing-card relative glass-card p-8 transition-all duration-200 ${
                plan.popular
                  ? "border-[#34D399]/50 scale-[1.05] z-10 shadow-[0_0_40px_rgba(52,211,153,0.2)]"
                  : "hover:translate-y-[-8px] hover:shadow-[0_8px_40px_rgba(52,211,153,0.1)]"
              }`}
            >
              {plan.popular && (
                <>
                  <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ boxShadow: "inset 0 0 0 1px rgba(52,211,153,0.3)" }} />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#E8C468] to-[#B8860B] text-[11px] font-bold text-[#0A0F0C] tracking-[0.08em] uppercase whitespace-nowrap shadow-[0_0_20px_rgba(232,196,104,0.4)]">Most Popular</div>
                </>
              )}
              <div className="relative z-1">
                <h3 className="text-[20px] font-semibold text-[#F0F7F3] mb-1">{plan.name}</h3>
                <p className="text-[13px] text-[#9FB0A6] mb-1">Up to {plan.leads} leads/mo</p>
                <div className="text-[36px] font-display font-bold text-[#F0F7F3] mt-6 mb-1">
                  {plan.price}
                  <span className="text-[15px] text-[#9FB0A6] font-sans font-normal">/mo</span>
                </div>
                <p className="text-[12px] text-[#6B7C73]">+ 18% GST ({plan.incl} incl.) · ≈{plan.perLead}/lead</p>

                {/* Stat chips: users / leads / dedicated number */}
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2.5 text-center">
                    <p className="text-[16px] font-bold text-[#F0F7F3] leading-none">{plan.users}</p>
                    <p className="text-[10px] text-[#9FB0A6] uppercase tracking-wide mt-1.5">Users</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2.5 text-center">
                    <p className="text-[16px] font-bold text-[#F0F7F3] leading-none">{plan.leads}</p>
                    <p className="text-[10px] text-[#9FB0A6] uppercase tracking-wide mt-1.5">Leads</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2.5 text-center">
                    <p className="text-[16px] font-bold leading-none" style={{ color: plan.dedicatedNumber ? "#34D399" : "#5C6B62" }}>
                      {plan.dedicatedNumber ? "✓" : "—"}
                    </p>
                    <p className="text-[10px] text-[#9FB0A6] uppercase tracking-wide mt-1.5">Number</p>
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-[14px] text-[#9FB0A6]">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <circle cx="8" cy="8" r="6" fill="#34D399" fillOpacity="0.2" />
                        <path d="M5 8l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={`block text-center py-3 px-6 rounded-lg mt-8 text-[15px] font-bold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                    plan.popular
                      ? "bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] shadow-[0_0_32px_rgba(52,211,153,0.4)] hover:shadow-[0_0_48px_rgba(52,211,153,0.55)]"
                      : "border border-white/15 text-[#F0F7F3] hover:bg-white/[0.06] hover:border-[#34D399]/40"
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
          <h3 className="text-[20px] font-semibold text-[#F0F7F3] text-center mb-8">Compare every plan</h3>
          <div className="overflow-x-auto rounded-2xl glass-card">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-4 gap-0 border-b border-white/10">
              <div className="px-6 py-4">
                <span className="text-[11px] font-semibold text-[#9FB0A6] uppercase tracking-[0.08em]">Feature</span>
              </div>
              {plans.map((p) => (
                <div key={p.name} className={`px-6 py-4 border-l border-white/10 ${p.popular ? "bg-[#34D399]/[0.07]" : ""}`}>
                  <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${p.popular ? "text-[#6FE3B0]" : "text-[#F0F7F3]"}`}>{p.name}</span>
                </div>
              ))}
            </div>
            {compareRows.map((row, i) => (
              <div key={row.label} className={`grid grid-cols-4 gap-0 ${i < compareRows.length - 1 ? "border-b border-white/[0.07]" : ""} hover:bg-white/[0.04] transition-colors`}>
                <div className="px-6 py-4 flex items-center">
                  <span className="text-[13px] text-[#D5E0D9]">{row.label}</span>
                </div>
                {plans.map((p) => {
                  const val = row.get(p);
                  return (
                    <div key={p.name} className={`px-6 py-4 flex items-center gap-2 border-l border-white/10 ${p.popular ? "bg-[#34D399]/[0.07]" : ""}`}>
                      {typeof val === "boolean" ? (
                        val ? (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                            <circle cx="8" cy="8" r="6" fill="#34D399" fillOpacity="0.2" />
                            <path d="M5 8l2 2 4-4" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span className="text-[14px] text-[#5C6B62]">—</span>
                        )
                      ) : (
                        <span className={`text-[13px] font-medium ${p.popular ? "text-[#6FE3B0]" : "text-[#9FB0A6]"}`}>{val}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          </div>
          <p className="text-center text-[12px] text-[#6B7C73] mt-4">All plans include full qualification, booking automation, WhatsApp notifications, and follow-up sequences. 18% GST applies.</p>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Check, X } from "lucide-react";
import { PLANS as PLAN_PAYLOAD } from "@/lib/plans.autogen";
import { GST_2_PLAN_DIFF } from "@/lib/site";

const SAVINGS_IN_RUPIAH = GST_2_PLAN_DIFF.toLocaleString("en-IN");

const comparisons = [
  { metric: "Response time", bridge: "≤60 seconds in calling hours", traditional: "When someone is free" },
  { metric: "Call capacity", bridge: "Every new lead, automatically", traditional: "About 40 calls a day" },
  { metric: "Languages", bridge: "Hinglish, Hindi, English", traditional: "1 language" },
  { metric: "Working hours", bridge: "9 AM - 9 PM IST, all days", traditional: "Office hours" },
  { metric: "Lead scoring", bridge: "AI-driven (0-100)", traditional: "Manual guesswork" },
  { metric: "Follow-up automation", bridge: "Auto Day 1 + Day 3", traditional: "Manual reminders" },
  { metric: "WhatsApp notifications", bridge: "Instant after every call", traditional: "None" },
  { metric: "Call recordings & transcripts", bridge: "Every call recorded", traditional: "Rarely done" },
  { metric: "Analytics dashboard", bridge: "Real-time funnel & metrics", traditional: "Excel sheets" },
  { metric: "Monthly cost", bridge: `from ₹${PLAN_PAYLOAD.plans[0].monthlyExGst.toLocaleString("en-IN")} + GST`, traditional: "₹20,000 - ₹30,000/person" },
  // Phase 2.1: the two capability-number claims below carry a footnote so
  // prospects know they're platform capability, not a promised outcome.
  { metric: "Leads handled", bridge: `up to ${PLAN_PAYLOAD.plans[2].leadsPerMonth.toLocaleString("en-IN")}/month on Pro`, traditional: "~200 per person", note: true },
  { metric: "Script consistency", bridge: "Follows your approved script", traditional: "Varies by agent", note: true },
];

export default function ComparisonSection() {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const rows = tableRef.current?.querySelectorAll(".comparison-row");
      if (!rows) return;

      gsap.fromTo(rows,
        { opacity: 0, x: -20 },
        {
          opacity: 1, x: 0, duration: 0.3, stagger: 0.03,
          ease: "power2.out",
          scrollTrigger: {
            trigger: tableRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );

      kill = () => {
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
      };
    };

    init();
    return () => { if (kill) kill(); };
  }, [inView]);

  return (
    <section ref={ref} className="relative py-20 lg:py-32 bg-canvas overflow-hidden" id="comparison">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <span className="caption mb-4 block">HEAD-TO-HEAD</span>
          <h2 className="h1-text mb-4">Converza vs. Traditional Telecaller</h2>
          <p className="body-text max-w-[520px] mx-auto">
            A capability comparison — what each approach offers. Results vary by broker and market.
          </p>
        </div>

        <div ref={tableRef} className="rounded-2xl border border-line overflow-hidden surface-card">
          {/* Header */}
          <div className="grid grid-cols-3 gap-0 border-b border-line">
            <div className="px-6 py-4">
              <span className="text-[11px] font-semibold text-ink-soft uppercase tracking-[0.08em]">Metric</span>
            </div>
            <div className="px-6 py-4 bg-brand/10 border-x border-line">
              <span className="text-[11px] font-semibold text-brand uppercase tracking-[0.08em]">Converza</span>
            </div>
            <div className="px-6 py-4">
              <span className="text-[11px] font-semibold text-danger uppercase tracking-[0.08em]">Telecaller</span>
            </div>
          </div>

          {/* Rows */}
          {comparisons.map((row, i) => (
            <div
              key={i}
              className="comparison-row grid grid-cols-3 gap-0 border-b border-line last:border-b-0 hover:bg-white/[0.02] transition-colors"
            >
              <div className="px-6 py-4 flex items-center">
                <span className="text-[13px] text-ink">{row.metric}</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2 bg-brand/10 border-x border-line">
                <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                <span className="text-[13px] text-brand font-medium">
                  {row.bridge}
                  {row.note && <sup className="ml-0.5 text-[10px] text-brand/70">*</sup>}
                </span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-danger shrink-0" />
                <span className="text-[13px] text-ink-soft">{row.traditional}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="mt-4 text-[12px] text-ink-muted text-center leading-relaxed">
          * Platform capability and a worked cost example, not a promise of results. Actual outcomes vary by broker, market and lead flow.
        </p>

        {/* Savings Callout */}
        <div className="mt-8 p-6 rounded-xl bg-brand/8 border border-brand/20 text-center">
          <p className="text-[15px] text-ink font-medium">
            💰 Example: 2 telecallers (₹50K/mo) vs Converza Growth (${PLAN_PAYLOAD.plans[1].monthlyInclGst.toLocaleString('en-IN')} incl. GST) — <span className="text-brand">about ₹${SAVINGS_IN_RUPIAH}</span> in this scenario
          </p>
        </div>
      </div>
    </section>
  );
}

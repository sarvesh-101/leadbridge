"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Check, X } from "lucide-react";

const comparisons = [
  { metric: "Response time", bridge: "≤60 seconds", traditional: "4-8 hours" },
  { metric: "Calls per day", bridge: "24/7 answering", traditional: "~40/day" },
  { metric: "Languages", bridge: "Hinglish, Hindi, English", traditional: "1 language" },
  { metric: "Working hours", bridge: "24/7 including holidays", traditional: "9 AM - 6 PM" },
  { metric: "Lead scoring", bridge: "AI-driven (0-100)", traditional: "Manual guesswork" },
  { metric: "Follow-up automation", bridge: "Auto Day 1 + Day 3", traditional: "Manual reminders" },
  { metric: "WhatsApp notifications", bridge: "Instant after every call", traditional: "None" },
  { metric: "Call recordings & transcripts", bridge: "Every call recorded", traditional: "Rarely done" },
  { metric: "Analytics dashboard", bridge: "Real-time funnel & metrics", traditional: "Excel sheets" },
  { metric: "Monthly cost", bridge: "₹18,000 - ₹60,000", traditional: "₹20,000 - ₹30,000/person" },
  // Phase 2.1: the two capability-number claims below carry a footnote so
  // prospects know they're platform capability, not a guaranteed outcome.
  { metric: "Leads handled", bridge: "500+ per month", traditional: "~200 per person", note: true },
  { metric: "Script consistency", bridge: "100% consistent", traditional: "Varies by agent", note: true },
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
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0A0F0C] overflow-hidden" id="comparison">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <span className="caption text-gradient-gold mb-4 block">HEAD-TO-HEAD</span>
          <h2 className="h1-text mb-4">LeadBridge vs. Traditional Telecaller</h2>
          <p className="text-[16px] text-[#9FB0A6] max-w-[520px] mx-auto">
            A capability comparison — what each approach offers. Results vary by broker and market.
          </p>
        </div>

        <div ref={tableRef} className="rounded-2xl border border-white/10 overflow-hidden glass-card">
          {/* Header */}
          <div className="grid grid-cols-3 gap-0 border-b border-white/10">
            <div className="px-6 py-4">
              <span className="text-[11px] font-semibold text-[#9FB0A6] uppercase tracking-[0.08em]">Metric</span>
            </div>
            <div className="px-6 py-4 bg-[#34D399]/[0.07] border-x border-white/10">
              <span className="text-[11px] font-semibold text-[#6FE3B0] uppercase tracking-[0.08em]">LeadBridge</span>
            </div>
            <div className="px-6 py-4">
              <span className="text-[11px] font-semibold text-[#FB7185] uppercase tracking-[0.08em]">Telecaller</span>
            </div>
          </div>

          {/* Rows */}
          {comparisons.map((row, i) => (
            <div
              key={i}
              className="comparison-row grid grid-cols-3 gap-0 border-b border-white/[0.07] last:border-b-0 hover:bg-white/[0.04] transition-colors"
            >
              <div className="px-6 py-4 flex items-center">
                <span className="text-[13px] text-[#D5E0D9]">{row.metric}</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2 bg-[#34D399]/[0.07] border-x border-white/10">
                <Check className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                <span className="text-[13px] text-[#6FE3B0] font-medium">
                  {row.bridge}
                  {row.note && <sup className="ml-0.5 text-[10px] text-[#6FE3B0]/70">*</sup>}
                </span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-[#FB7185] shrink-0" />
                <span className="text-[13px] text-[#9FB0A6]">{row.traditional}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Phase 2.1: footnote for the capability claims above */}
        <p className="mt-4 text-[12px] text-[#6B7C73] text-center leading-relaxed">
          * Platform capability, not a guarantee. Actual results vary by broker, market and lead flow.
        </p>

        {/* Savings Callout */}
        <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-[#34D399]/10 to-[#1B4332]/20 border border-[#34D399]/20 text-center">
          <p className="text-[15px] text-[#D5E0D9] font-medium">
            💰 Example: 2 telecallers (₹50K/mo) vs LeadBridge Growth (₹35K/mo) — <span className="text-[#6FE3B0]">about ₹15K/mo less</span> in this scenario
          </p>
        </div>
      </div>
    </section>
  );
}

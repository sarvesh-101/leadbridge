"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Check, X } from "lucide-react";

const comparisons = [
  { metric: "Response time", bridge: "≤60 seconds", traditional: "4-8 hours" },
  { metric: "Calls per day", bridge: "Unlimited (24/7)", traditional: "~40/day" },
  { metric: "Languages", bridge: "Hinglish, Hindi, English", traditional: "1 language" },
  { metric: "Working hours", bridge: "24/7 including holidays", traditional: "9 AM - 6 PM" },
  { metric: "Lead scoring", bridge: "AI-driven (0-100)", traditional: "Manual guesswork" },
  { metric: "Follow-up automation", bridge: "Auto Day 1 + Day 3", traditional: "Manual reminders" },
  { metric: "WhatsApp notifications", bridge: "Instant after every call", traditional: "None" },
  { metric: "Call recordings & transcripts", bridge: "Every call recorded", traditional: "Rarely done" },
  { metric: "Analytics dashboard", bridge: "Real-time funnel & metrics", traditional: "Excel sheets" },
  { metric: "Monthly cost", bridge: "₹18,000 - ₹60,000", traditional: "₹20,000 - ₹30,000/person" },
  { metric: "Leads handled", bridge: "500+ per month", traditional: "~200 per person" },
  { metric: "Script consistency", bridge: "100% consistent", traditional: "Varies by agent" },
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
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0A0A0F]" id="comparison">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#F43F5E] mb-4 block">THE NUMBERS DON&apos;T LIE</span>
          <h2 className="h1-text mb-4">LeadBridge vs. Traditional Telecaller</h2>
          <p className="text-[16px] text-[#6B6B8A] max-w-[520px] mx-auto">
            See how AI calling compares to the old way of doing things. The difference is stark.
          </p>
        </div>

        <div ref={tableRef} className="rounded-2xl border border-[#2A2A3A] overflow-hidden bg-[#111118]">
          {/* Header */}
          <div className="grid grid-cols-3 gap-0 border-b border-[#2A2A3A]">
            <div className="px-6 py-4">
              <span className="text-[11px] font-semibold text-[#6B6B8A] uppercase tracking-[0.08em]">Metric</span>
            </div>
            <div className="px-6 py-4 bg-[#4F6EF7]/5 border-x border-[#2A2A3A]">
              <span className="text-[11px] font-semibold text-[#4F6EF7] uppercase tracking-[0.08em]">LeadBridge</span>
            </div>
            <div className="px-6 py-4">
              <span className="text-[11px] font-semibold text-[#F43F5E] uppercase tracking-[0.08em]">Telecaller</span>
            </div>
          </div>

          {/* Rows */}
          {comparisons.map((row, i) => (
            <div
              key={i}
              className="comparison-row grid grid-cols-3 gap-0 border-b border-[#2A2A3A] last:border-b-0 hover:bg-[#1A1A24] transition-colors"
            >
              <div className="px-6 py-4 flex items-center">
                <span className="text-[13px] text-[#F0F0F8]">{row.metric}</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2 bg-[#4F6EF7]/5 border-x border-[#2A2A3A]">
                <Check className="w-3.5 h-3.5 text-[#22D3A5] shrink-0" />
                <span className="text-[13px] text-[#22D3A5] font-medium">{row.bridge}</span>
              </div>
              <div className="px-6 py-4 flex items-center gap-2">
                <X className="w-3.5 h-3.5 text-[#F43F5E] shrink-0" />
                <span className="text-[13px] text-[#6B6B8A]">{row.traditional}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Savings Callout */}
        <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-[#22D3A5]/5 to-[#4F6EF7]/5 border border-[#22D3A5]/10 text-center">
          <p className="text-[15px] text-[#F0F0F8] font-medium">
            💰 Replace 2 telecallers (₹50K/mo) with LeadBridge Growth (₹35K/mo) — <span className="text-[#22D3A5]">save ₹15K/mo</span> while handling <span className="text-[#22D3A5]">3x more leads</span>
          </p>
        </div>
      </div>
    </section>
  );
}

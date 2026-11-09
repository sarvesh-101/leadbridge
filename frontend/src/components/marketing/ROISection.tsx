"use client";

import { useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { IndianRupee, Users, ArrowRight } from "lucide-react";
import { PLANS as PLAN_PAYLOAD } from "@/lib/plans.autogen";

/**
 * V2 (T10) — ROI calculator, honest version.
 *
 * Compares two telecallers (editable monthly cost, default ₹50,000 total) at
 * ~400 leads against Converza Growth. Output is COST PER LEAD on both sides and
 * the assumptions are always visible. No uplift percentages, no invented
 * bookings — we have no published results.
 */
const GROWTH = PLAN_PAYLOAD.plans.find((p) => p.id === "GROWTH")!;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function ROISection() {
  const { ref } = useInView({ threshold: 0.1, triggerOnce: true });
  const [telecallerCost, setTelecallerCost] = useState(50000);
  const [leads, setLeads] = useState(400);

  const numbers = useMemo(() => {
    const telecallerPerLead = leads > 0 ? telecallerCost / leads : 0;
    const converzaPerLead = leads > 0 ? GROWTH.monthlyInclGst / leads : 0;
    return {
      telecallerPerLead,
      converzaPerLead,
      difference: telecallerPerLead - converzaPerLead,
      includedLeads: GROWTH.leadsPerMonth,
      overage: GROWTH.overagePerLeadExGst,
    };
  }, [telecallerCost, leads]);

  return (
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0A0F0C] overflow-hidden" id="roi">
      <div className="absolute top-1/4 right-[-120px] w-[440px] h-[440px] rounded-full bg-[#E8C468] opacity-[0.05] blur-[130px] pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-12">
          <span className="caption text-gradient-gold mb-4 block">COST PER LEAD</span>
          <h2 className="h1-text mb-4">Two telecallers, or Converza</h2>
          <p className="text-[16px] text-[#9FB0A6] max-w-[560px] mx-auto">
            A like-for-like cost comparison on the same lead volume. Your team still closes — the AI handles the first call and the follow-ups.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <label className="p-6 rounded-xl glass-card block">
            <span className="text-[13px] text-[#9FB0A6] flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" /> Two telecallers cost you (monthly, total)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[20px] text-[#9FB0A6]">₹</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={telecallerCost}
                onChange={(e) => setTelecallerCost(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-transparent text-[28px] font-display font-bold text-[#F0F7F3] outline-none focus:ring-0"
                aria-label="Monthly telecaller cost in rupees"
              />
            </div>
          </label>

          <label className="p-6 rounded-xl glass-card block">
            <span className="text-[13px] text-[#9FB0A6] flex items-center gap-2 mb-2">
              <ArrowRight className="w-4 h-4" /> Leads handled per month
            </span>
            <input
              type="number"
              min={1}
              step={50}
              value={leads}
              onChange={(e) => setLeads(Math.max(1, Number(e.target.value) || 1))}
              className="w-full bg-transparent text-[28px] font-display font-bold text-[#F0F7F3] outline-none focus:ring-0"
              aria-label="Leads handled per month"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-xl glass-card">
            <p className="text-[12px] uppercase tracking-wide text-[#9FB0A6] mb-2">Two telecallers</p>
            <p className="text-[32px] font-display font-bold text-[#FB7185]">
              {inr(numbers.telecallerPerLead)}<span className="text-[14px] font-sans font-normal text-[#9FB0A6]"> / lead</span>
            </p>
            <p className="text-[12px] text-[#6B7C73] mt-2">
              {inr(telecallerCost)} a month for about {leads.toLocaleString("en-IN")} leads, in office hours only.
            </p>
          </div>

          <div className="p-6 rounded-xl glass-card border-[#34D399]/30">
            <p className="text-[12px] uppercase tracking-wide text-[#6FE3B0] mb-2">Converza Growth</p>
            <p className="text-[32px] font-display font-bold text-[#34D399]">
              {inr(numbers.converzaPerLead)}<span className="text-[14px] font-sans font-normal text-[#9FB0A6]"> / lead</span>
            </p>
            <p className="text-[12px] text-[#6B7C73] mt-2">
              {inr(GROWTH.monthlyInclGst)} incl. 18% GST covers up to {numbers.includedLeads.toLocaleString("en-IN")} leads.
              Extra leads are prepaid at {inr(numbers.overage)} each, before GST.
            </p>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl glass-card">
          <p className="text-[12px] text-[#9FB0A6] leading-relaxed">
            <strong className="text-[#F0F7F3]">Assumptions:</strong> two telecallers at {inr(telecallerCost)} a month combined,
            about {leads.toLocaleString("en-IN")} leads a month, office-hours calling, and the Growth plan at its
            GST-inclusive price. Telecallers can negotiate and close; Converza runs the first call and the follow-ups.
            This is arithmetic on your inputs, not a forecast of results.
          </p>
        </div>

        <p className="mt-4 text-center text-[12px] text-[#6B7C73] flex items-center justify-center gap-1">
          <IndianRupee className="w-3.5 h-3.5" />
          Difference in this scenario: {numbers.difference >= 0 ? inr(numbers.difference) : inr(0)} per lead
        </p>
      </div>
    </section>
  );
}

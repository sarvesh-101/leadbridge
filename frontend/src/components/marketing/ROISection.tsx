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
    <section ref={ref} className="relative py-20 lg:py-32 bg-canvas overflow-hidden" id="roi">
      <div className="absolute top-1/4 right-[-120px] w-[440px] h-[440px] rounded-full bg-brand-deep opacity-25 blur-[130px] pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">          <div className="text-center mb-12">
          <span className="caption mb-4 block">COST PER LEAD</span>
          <h2 className="h1-text mb-4">Two telecallers, or Converza</h2>
          <p className="body-text max-w-[560px] mx-auto">
            A like-for-like cost comparison on the same lead volume. Your team still closes — the AI handles the first call and the follow-ups.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <label className="p-6 rounded-xl surface-card block">
            <span className="text-[13px] text-ink-soft flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" /> Two telecallers cost you (monthly, total)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[20px] text-ink-soft">₹</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={telecallerCost}
                onChange={(e) => setTelecallerCost(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-transparent text-[28px] font-display font-bold text-ink outline-none focus:ring-0"
                aria-label="Monthly telecaller cost in rupees"
              />
            </div>
          </label>

          <label className="p-6 rounded-xl surface-card block">
            <span className="text-[13px] text-ink-soft flex items-center gap-2 mb-2">
              <ArrowRight className="w-4 h-4" /> Leads handled per month
            </span>
            <input
              type="number"
              min={1}
              step={50}
              value={leads}
              onChange={(e) => setLeads(Math.max(1, Number(e.target.value) || 1))}
              className="w-full bg-transparent text-[28px] font-display font-bold text-ink outline-none focus:ring-0"
              aria-label="Leads handled per month"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-xl surface-card">
            <p className="text-[12px] uppercase tracking-wide text-ink-soft mb-2">Two telecallers</p>
            <p className="text-[32px] font-bold text-danger" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
              {inr(numbers.telecallerPerLead)}<span className="text-[14px] font-normal text-ink-soft"> / lead</span>
            </p>
            <p className="text-[12px] text-ink-muted mt-2">
              {inr(telecallerCost)} a month for about {leads.toLocaleString("en-IN")} leads, in office hours only.
            </p>
          </div>

          <div className="p-6 rounded-xl surface-card" style={{ border: "1px solid var(--accent-primary)" }}>
            <p className="text-[12px] uppercase tracking-wide text-brand mb-2">Converza Growth</p>
            <p className="text-[32px] font-bold text-brand" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
              {inr(numbers.converzaPerLead)}<span className="text-[14px] font-normal text-ink-soft"> / lead</span>
            </p>
            <p className="text-[12px] text-ink-muted mt-2">
              {inr(GROWTH.monthlyInclGst)} incl. 18% GST covers up to {numbers.includedLeads.toLocaleString("en-IN")} leads.
              Extra leads are prepaid at {inr(numbers.overage)} each, before GST.
            </p>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-xl surface-card">
          <p className="text-[12px] text-ink-soft leading-relaxed">
            <strong className="text-ink">Assumptions:</strong> two telecallers at {inr(telecallerCost)} a month combined,
            about {leads.toLocaleString("en-IN")} leads a month, office-hours calling, and the Growth plan at its
            GST-inclusive price. Telecallers can negotiate and close; Converza runs the first call and the follow-ups.
            This is arithmetic on your inputs, not a forecast of results.
          </p>
        </div>

        <p className="mt-4 text-center text-[12px] text-ink-muted flex items-center justify-center gap-1">
          <IndianRupee className="w-3.5 h-3.5" />
          Difference in this scenario: {numbers.difference >= 0 ? inr(numbers.difference) : inr(0)} per lead
        </p>
      </div>
    </section>
  );
}

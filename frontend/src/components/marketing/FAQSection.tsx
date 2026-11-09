"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PLANS } from "@/lib/plans.autogen";
import { POLICY_REFUND_TEXT, SUPPORT_EMAIL, CAPTURE_LINE } from "@/lib/site";

/**
 * V2 (T10) — FAQ per Appendix B. No unsourced claims, no "24/7 calling",
 * no implication that leads mistake the AI for a human. The refund answer only
 * renders when the owner has supplied POLICY_REFUND_TEXT.
 */
const pricingText =
  PLANS.plans
    .map(
      (p) =>
        `${p.name} is ₹${p.monthlyExGst.toLocaleString("en-IN")}/mo (+ 18% GST — ₹${p.monthlyInclGst.toLocaleString(
          "en-IN"
        )} incl.) for up to ${p.leadsPerMonth.toLocaleString("en-IN")} leads handled per month with team access for ${p.teamUsers} users`
    )
    .join(". ") +
  ". Extra leads are bought as prepaid credit and nothing stops mid-month. There is no setup fee.";

const baseFaqs = [
  {
    q: "Is it an AI on the call?",
    a: "Yes. It says so at the start of every call, and it never pretends to be a person if asked.",
  },
  {
    q: "Are calls recorded?",
    a: "They may be, and the lead is told at the start of the call. You can listen to every recording in your dashboard.",
  },
  {
    q: "When does it call?",
    a: "Between 9 AM and 9 PM IST. Leads arriving at night are called when the window opens. " + CAPTURE_LINE + ".",
  },
  {
    q: "Does it speak Hinglish?",
    a: "Hinglish is the default. Hindi and English are also available, and the AI adapts to the language the lead uses.",
  },
  {
    q: "How much does it cost?",
    a: pricingText,
  },
  {
    q: "What does a lead cost?",
    a: "From about ₹50 to ₹75 per lead before GST, depending on the plan. The pricing section shows the exact per-lead figure for each plan.",
  },
  {
    q: "What happens if I use more leads than my plan?",
    a: "You can buy extra leads as prepaid credit at your plan's overage rate. Nothing stops mid-month, and unused credit carries over.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, anytime. Your territory is held while the subscription is active.",
  },
  {
    q: "Is my city or zone exclusive?",
    a: "While your territory is active, we will not onboard another Converza broker for the same zone. A zone is a micro-market on the territory map — not a whole metro. It does not stop anyone from using other tools.",
  },
  {
    q: "How do I get started?",
    a: "Check the territory map, claim a zone, and sign up. Your 30-day trial starts immediately; onboarding covers your business details, AI script, lead sources, calling number and a test call to your own phone.",
  },
  {
    q: "Do you offer a trial?",
    a: `Yes — ${PLANS.trial.days} days, up to ${PLANS.trial.maxLeads} leads, no credit card. You see your own numbers on your own leads before paying.`,
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const faqs = POLICY_REFUND_TEXT
    ? [...baseFaqs, { q: "What is your refund policy?", a: POLICY_REFUND_TEXT }]
    : baseFaqs;

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);
  void refundOpen;
  void setRefundOpen;

  return (
    <section className="relative py-20 lg:py-32 bg-[#0A0F0C] overflow-hidden" id="faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <span className="caption text-gradient-emerald mb-4 block">QUESTIONS?</span>
          <h2 className="h1-text mb-4">Everything you need to know</h2>
          <p className="text-[16px] text-[#9FB0A6] max-w-[480px] mx-auto">
            Can&apos;t find what you&apos;re looking for? Reach out to our team.
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={faq.q} className="rounded-xl glass-card overflow-hidden transition-colors duration-200 hover:border-[#34D399]/30">
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                aria-expanded={openIndex === i}
              >
                <span className="text-[14px] font-medium text-[#D5E0D9] flex-1">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#9FB0A6] shrink-0 transition-transform duration-200 ${
                    openIndex === i ? "rotate-180 text-[#34D399]" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <div className="px-6 pb-4 pt-0">
                      <p className="text-[13px] text-[#9FB0A6] leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-[13px] text-[#9FB0A6] mb-3">Still have questions?</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 text-[14px] text-[#6FE3B0] hover:text-[#34D399] font-medium transition-colors"
          >
            Contact our team →
          </a>
        </div>
      </div>
    </section>
  );
}

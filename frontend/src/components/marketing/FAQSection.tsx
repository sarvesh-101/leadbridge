"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "How does LeadBridge work?",
    a: "When a lead comes in from 99acres, MagicBricks, JustDial, or any connected source, our AI agent calls them within 60 seconds. It introduces itself, asks qualifying questions (budget, location, timeline, property type), answers their questions, and if interested — books a site visit. You get a WhatsApp summary instantly.",
  },
  {
    q: "Do leads know it's an AI?",
    a: "Our AI speaks in natural Hinglish and handles conversations so seamlessly that most leads don't realize it's AI. If asked directly, it transparently identifies itself as an AI assistant. The focus is on providing value — booking a visit — rather than deception.",
  },
  {
    q: "Which lead sources do you support?",
    a: "We integrate with 99acres, MagicBricks, Housing.com, JustDial, and any custom webhook. Leads can also come in via WhatsApp, SMS, or your website contact form. If it can send an HTTP request or webhook, we can ingest it.",
  },
  {
    q: "How much does it cost?",
    a: "Starter plan is ₹18,000/mo for 100 AI calls. Growth is ₹35,000/mo for 300 calls. Pro is ₹60,000/mo for unlimited calls. All plans include full qualification, booking, WhatsApp notifications, and follow-up automation. There's no setup fee.",
  },
  {
    q: "What languages does the AI speak?",
    a: "The AI primarily speaks Hinglish (Hindi + English mix) which is what most Indian real estate leads prefer. It can handle pure Hindi, pure English, and adapts to the lead's preferred language dynamically during the conversation.",
  },
  {
    q: "How is this different from a telecaller?",
    a: "A telecaller costs ₹20,000-₹30,000/mo, handles ~40 calls/day, works limited hours, and takes breaks. LeadBridge costs less, handles unlimited concurrent calls, works 24/7, never gets tired, and calls every lead within 60 seconds — including weekends and holidays.",
  },
  {
    q: "Can I customize the call script?",
    a: "Yes! You can customize the AI's greeting, questions, objection handling, and closing script from the dashboard. You can also run A/B tests to see which scripts perform best. The AI uses your property data (from your listings) to answer specific questions.",
  },
  {
    q: "What happens if a lead doesn't answer?",
    a: "The AI automatically retries up to 3 times with increasing intervals. If still no answer, it sends you a notification. If they answer later, follow-up calls are scheduled (Day 1 and Day 3) automatically. You can configure all of this in Campaigns.",
  },
  {
    q: "How do I know what happened on a call?",
    a: "After every call, you get a WhatsApp notification with a summary — lead name, budget, location, timeline, sentiment, and whether a visit was booked. You can also listen to call recordings and read full transcripts in the dashboard.",
  },
  {
    q: "Is my city/territory exclusive?",
    a: "Yes! Each city or zone is assigned to one broker only. Once you claim your territory, no other broker can use LeadBridge in that area. Check the Territory Map on this page to see which cities are available. First come, first locked.",
  },
  {
    q: "How do I get started?",
    a: "Click 'Request Your City', fill in your details and city. We'll verify your territory is available and set you up within 24 hours. Setup takes about 10 minutes — connect your lead sources, configure your script, and the AI starts calling immediately.",
  },
  {
    q: "Do you offer a trial?",
    a: "We offer a 7-day trial with 30 AI calls included — no credit card required. You can see the results before committing. After the trial, you can choose any plan that fits your volume. If LeadBridge isn't right, just let us know.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section className="relative py-20 lg:py-32 bg-[#0A0A0F]" id="faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#6B6B8A] mb-4 block">QUESTIONS?</span>
          <h2 className="h1-text mb-4">Everything you need to know</h2>
          <p className="text-[16px] text-[#6B6B8A] max-w-[480px] mx-auto">
            Can&apos;t find what you&apos;re looking for? Reach out to our team.
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-[#2A2A3A] bg-[#111118] overflow-hidden transition-colors duration-200 hover:border-[#3A3A52]"
            >
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
              >
                <span className="text-[14px] font-medium text-[#F0F0F8] flex-1">{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#6B6B8A] shrink-0 transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
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
                      <p className="text-[13px] text-[#6B6B8A] leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-10">
          <p className="text-[13px] text-[#6B6B8A] mb-3">Still have questions?</p>
          <a
            href="mailto:support@leadbridge.com"
            className="inline-flex items-center gap-2 text-[14px] text-[#4F6EF7] hover:text-[#4F6EF7]/80 font-medium transition-colors"
          >
            Contact our team →
          </a>
        </div>
      </div>
    </section>
  );
}

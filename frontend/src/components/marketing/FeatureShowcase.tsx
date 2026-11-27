"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { PhoneCall, MessageSquareText, CalendarCheck, BarChart3, Languages, RefreshCw } from "lucide-react";

// V2 (T10): six outcome cards from Appendix B. The full capability list moved
// to /features — this section only promises what the product actually does.
const features = [
  {
    icon: PhoneCall,
    title: "Called in 60 seconds",
    description: "New leads get an AI call within 60 seconds during calling hours (9 AM to 9 PM IST).",
  },
  {
    icon: Languages,
    title: "Qualified in Hinglish",
    description: "Budget, location, property type and timeline — asked naturally in Hinglish, Hindi or English.",
  },
  {
    icon: CalendarCheck,
    title: "Site visits booked",
    description: "Reminders go out 24 hours before. Missed visits get recovery follow-ups.",
  },
  {
    icon: MessageSquareText,
    title: "Summary on WhatsApp",
    description: "After every call: who, what was agreed, next step and a recording.",
  },
  {
    icon: RefreshCw,
    title: "Follow-up until yes or cold",
    description: "Retries and a 3-day sequence (7-day on Pro). Cold leads are marked so you stop chasing them.",
  },
  {
    icon: BarChart3,
    title: "See what's working",
    description: "Every recording and transcript, cost per lead and conversion by source, plus a weekly report.",
  },
];

export default function FeatureShowcase() {
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const cards = containerRef.current?.querySelectorAll(".feature-card");
      if (!cards) return;

      gsap.fromTo(cards,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: 0.5, stagger: 0.05,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
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
    <section ref={ref} className="relative py-20 lg:py-32 bg-canvas overflow-hidden" id="features">
      {/* Subtle orange glow behind feature section */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-brand opacity-[0.04] blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <span className="caption mb-4 block">POWERED BY AI</span>
          <h2 className="h1-text mb-4">What you actually get</h2>
          <p className="body-text max-w-[600px] mx-auto">
            Six outcomes, measured on your own leads — no borrowed benchmarks.
          </p>
        </div>

        <div ref={containerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="feature-card group relative"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/25 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink mb-1.5 group-hover:text-white transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-[13px] text-ink-soft leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
                {/* Hover glow — subtle orange */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(242, 140, 69, 0.06), transparent 40%)" }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (rect) {
                      e.currentTarget.style.setProperty("--mouse-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
                      e.currentTarget.style.setProperty("--mouse-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link href="/features" className="inline-flex items-center gap-2 text-[14px] text-brand hover:text-brand-soft font-medium transition-colors">
            See every feature →
          </Link>
        </div>
      </div>
    </section>
  );
}

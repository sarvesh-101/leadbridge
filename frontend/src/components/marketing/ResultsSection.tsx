"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";

// V2 (T10): target metrics only — no unsourced averages, no 24/7 calling claim.
const stats = [
  { value: 60, suffix: "s", label: "Target time to first call", subtext: "During calling hours, 9 AM to 9 PM IST" },
  { value: 9, suffix: "–9", label: "Calling hours, every day", subtext: "Night leads are called when the window opens" },
  { value: 3, suffix: "+", label: "Follow-up attempts", subtext: "Then a Day 1 and Day 3 sequence (7 days on Pro)" },
];

export default function ResultsSection() {
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: lineRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      }

      kill = () => {
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
      };
    };

    init();

    return () => {
      if (kill) kill();
    };
  }, [inView]);

  return (
    <section className="relative py-20 lg:py-32 bg-canvas overflow-hidden" ref={ref}>
      {/* subtle copper accent */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[400px] rounded-full bg-brand-deep opacity-30 blur-[130px] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="surface-card p-8 hover:translate-y-[-2px] hover:border-brand-copper transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
              <div className="text-[72px] font-bold text-accent leading-none mb-3" style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
                {`${stat.value}${stat.suffix}`}
              </div>
              <p className="text-[16px] font-medium text-ink-soft mb-2">{stat.label}</p>
              <p className="text-[13px] text-ink-muted">{stat.subtext}</p>
              {i < stats.length - 1 && (
                <div ref={i === 0 ? lineRef : undefined} className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-32 bg-white/10 origin-top" />
              )}
            </div>
          ))}
        </div>

        {/* V2 (T10): early access is stated plainly — we have no published results. */}
        <p className="mt-8 text-center text-[13px] text-ink-soft">
          Early access — first brokers only. Your own numbers, when you start.
        </p>
      </div>
    </section>
  );
}

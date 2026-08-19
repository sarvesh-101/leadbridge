"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";

const stats = [
  { value: 60, suffix: "s", label: "Target time to first call", subtext: "Industry average response: 4–8 hours" },
  { value: 24, suffix: "/7", label: "Calling coverage", subtext: "AI never sleeps — weekends included" },
  { value: 3, suffix: "+", label: "Follow-up attempts", subtext: "Day 1 + Day 3 automatic sequence" },
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
    <section className="relative py-20 lg:py-32 bg-[#0A0F0C] overflow-hidden" ref={ref}>
      {/* aurora accent */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[400px] rounded-full bg-[#1B4332] opacity-40 blur-[130px] pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="glass-card p-8 hover:translate-y-[-2px] hover:shadow-[0_8px_40px_rgba(52,211,153,0.12)] transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#34D399]/60 to-transparent" />
              <div className="text-[72px] font-display font-bold text-gradient-emerald leading-none mb-3">
                {`${stat.value}${stat.suffix}`}
              </div>
              <p className="text-[16px] font-medium text-[#9FB0A6] mb-2">{stat.label}</p>
              <p className="text-[13px] text-[#6B7C73]">{stat.subtext}</p>
              {i < stats.length - 1 && (
                <div ref={i === 0 ? lineRef : undefined} className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-32 bg-white/10 origin-top" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

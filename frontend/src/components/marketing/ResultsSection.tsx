"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import CountUp from "react-countup";

const stats = [
  { value: 60, suffix: "s", label: "Average time to first call", subtext: "Industry average: 4–8 hours", noCountUp: true },
  { value: 94, suffix: "%", label: "Gross margin per client", subtext: "After all AI and calling costs" },
  { value: 3, suffix: "x", label: "More bookings per month", subtext: "Compared to manual follow-up" },
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
    <section className="relative py-20 lg:py-32 bg-[#0A0A0F]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="glass-card p-8 hover:translate-y-[-2px] hover:shadow-lg transition-all duration-200 relative overflow-hidden"
            >
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#4F6EF7]/50 to-transparent" />
              <div className="text-[72px] font-display font-bold text-[#F0F0F8] leading-none mb-3">
                {inView && !stat.noCountUp ? (
                  <CountUp end={stat.value} suffix={stat.suffix} duration={2} useEasing separator="" />
                ) : stat.noCountUp ? (
                  `${stat.value}${stat.suffix}`
                ) : (
                  `0${stat.suffix}`
                )}
              </div>
              <p className="text-[16px] font-medium text-[#6B6B8A] mb-2">{stat.label}</p>
              <p className="text-[13px] text-[#3A3A52]">{stat.subtext}</p>
              {i < stats.length - 1 && (
                <div ref={i === 0 ? lineRef : undefined} className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-32 bg-[#2A2A3A] origin-top" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

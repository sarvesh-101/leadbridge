"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const GlobeCanvas = dynamic(() => import("@/components/canvas/GlobeCanvas"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const eyebrowRef = useRef<HTMLSpanElement>(null);
  const line1Ref = useRef<HTMLHeadingElement>(null);
  const line2Ref = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const mod = await import("gsap");
      const st = await import("gsap/ScrollTrigger");
      const gsap = mod.gsap;
      const ScrollTrigger = st.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      const tl = gsap.timeline({ defaults: { ease: "power2.out", duration: 0.6 } });

      tl.fromTo(
        ".globe-container",
        { opacity: 0 },
        { opacity: 1, duration: 0.8 },
        0
      )
        .fromTo(eyebrowRef.current, { y: -20, opacity: 0 }, { y: 0, opacity: 1 }, 0.3)
        .fromTo(line1Ref.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, 0.5)
        .fromTo(line2Ref.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1 }, 0.7)
        .fromTo(subheadRef.current, { opacity: 0 }, { opacity: 1 }, 0.9)
        .fromTo(ctaRef.current, { opacity: 0 }, { opacity: 1 }, 1.1)
        .fromTo(
          scrollRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.4 },
          1.3
        );

      kill = () => {
        tl.kill();
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
      };
    };

    init();

    return () => {
      if (kill) kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden bg-[#0A0A0F]"
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#4F6EF7] opacity-[0.03] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-0">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-0">
          {/* Left: Content */}
          <div className="flex-1 lg:pr-12 z-10">
            <span
              ref={eyebrowRef}
              className="caption text-[#C9A84C] mb-6 block opacity-0"
            >
              EXCLUSIVE · ONE BROKER PER CITY
            </span>

            <h1 className="text-[clamp(36px,8vw,72px)] font-display font-bold leading-[0.95] text-[#F0F0F8] tracking-[-0.04em] mb-6">
              <span ref={line1Ref} className="block opacity-0">
                Your leads call
              </span>
              <span
                ref={line2Ref}
                className="block opacity-0 mt-2"
              >
                themselves back.
              </span>
            </h1>

            <p
              ref={subheadRef}
              className="text-[15px] sm:text-[18px] text-[#6B6B8A] max-w-[480px] leading-relaxed mb-10 opacity-0"
            >
              LeadBridge puts an AI agent on every inbound lead
              within 60 seconds — qualifying, booking, following up —
              while you focus on closing.
            </p>

            <div
              ref={ctaRef}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 opacity-0"
            >
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#4F6EF7] text-white text-[16px] font-semibold transition-all duration-150 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]"
                style={{ boxShadow: "0 0 32px #4F6EF740" }}
              >
                Request Your City
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="ml-1"
                >
                  <path
                    d="M3.333 8h9.334M8 3.333L12.667 8 8 12.667"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="#demo"
                className="inline-flex items-center gap-2 text-[#6B6B8A] text-[16px] font-medium hover:underline transition-colors"
              >
                See it live ↓
              </Link>
            </div>
          </div>

          {/* Right: Globe */}
          <div className="flex-1 relative flex items-center justify-center h-[300px] sm:h-[400px] lg:h-[600px]">
            <div className="globe-container absolute inset-0 opacity-0">
              <GlobeCanvas />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div
        ref={scrollRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0"
      >
        <div className="flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[11px] font-medium text-[#6B6B8A] tracking-[0.08em] uppercase">
            Scroll
          </span>
          <svg
            width="16"
            height="24"
            viewBox="0 0 16 24"
            fill="none"
          >
            <rect
              x="1"
              y="1"
              width="14"
              height="22"
              rx="7"
              stroke="#6B6B8A"
              strokeWidth="1.5"
            />
            <circle
              cx="8"
              cy="9"
              r="2"
              fill="#4F6EF7"
              className="animate-pulse"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}

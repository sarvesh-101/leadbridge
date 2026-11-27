"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const LeadPulseCanvas = dynamic(() => import("@/components/canvas/LeadPulseCanvas"), {
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
        { opacity: 0, y: 24, scale: 0.92 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8 },
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
      className="relative min-h-screen flex items-center overflow-hidden bg-hero-glow"
    >
      {/* Subtle grid + grain */}
      <div className="absolute inset-0 bg-grid-dark pointer-events-none opacity-50" />
      <div className="absolute inset-0 bg-grain pointer-events-none" />

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-0">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-0">
          {/* Left: Content */}
          <div className="flex-1 lg:pr-12 z-10">
            <span
              ref={eyebrowRef}
              className="caption mb-6 block opacity-0"
            >
              AI LEAD CONVERSION · CALLS WITHIN 60 SECONDS
            </span>

            <h1 className="hero-text mb-6">
              <span ref={line1Ref} className="block opacity-0">
                Every enquiry
              </span>
              <span
                ref={line2Ref}
                className="block opacity-0 mt-2 text-accent"
              >
                called back in 60 seconds.
              </span>
            </h1>

            <p
              ref={subheadRef}
              className="body-text max-w-[480px] mb-10 opacity-0"
            >
              Converza&apos;s AI calls your new leads within 60 seconds —
              qualifying them, booking site visits and sending you the summary on
              WhatsApp. Intelligent lead conversion for international B2B.
            </p>

            <div
              ref={ctaRef}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 opacity-0"
            >
              <Link
                href="/features"
                className="btn-accent inline-flex items-center gap-2 px-8 py-4 text-[15px] font-semibold"
              >
                See how it works
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="ml-1"
                >
                  <path
                    d="M3.333 8.667h9.334M8 4.667l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link
                href="/auth/register"
                className="inline-flex items-center gap-2 text-[16px] font-medium text-ink-soft hover:text-ink transition-colors"
              >
                Start free trial
              </Link>
            </div>
          </div>

          {/* Right: Globe */}
          <div className="flex-1 relative flex items-center justify-center h-[300px] sm:h-[400px] lg:h-[550px]">
            <div className="globe-container absolute inset-0 opacity-0">
              <LeadPulseCanvas scale={1.2} />
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
          <span className="text-[11px] font-medium text-ink-soft tracking-[0.08em] uppercase">
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
              stroke="var(--text-secondary)"
              strokeWidth="1.5"
            />
            <circle
              cx="8"
              cy="9"
              r="2"
              fill="var(--accent-primary)"
              className="animate-pulse"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}

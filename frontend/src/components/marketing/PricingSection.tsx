"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "₹18,000",
    calls: "100 AI calls",
    features: [
      "Full qualification + booking",
      "WhatsApp notifications",
      "3-day follow-up automation",
      "Basic analytics",
    ],
    popular: false,
  },
  {
    name: "Growth",
    price: "₹35,000",
    calls: "300 AI calls",
    features: [
      "Full qualification + booking",
      "WhatsApp notifications",
      "3-day follow-up automation",
      "Dedicated calling number",
      "Priority support",
      "Advanced analytics",
    ],
    popular: true,
  },
  {
    name: "Pro",
    price: "₹60,000",
    calls: "Unlimited calls",
    features: [
      "Full qualification + booking",
      "WhatsApp notifications",
      "7-day follow-up automation",
      "Dedicated calling number",
      "White-label option",
      "Dedicated account manager",
    ],
    popular: false,
  },
];

export default function PricingSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const cards = sectionRef.current?.querySelectorAll(".pricing-card");
      if (!cards || cards.length < 3) return;

      const st1 = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 70%",
        toggleActions: "play none none none",
        onEnter: () => {
          gsap.fromTo(cards[0], { opacity: 0, x: -100 }, { opacity: 1, x: 0, duration: 0.6 });
          gsap.fromTo(cards[2], { opacity: 0, x: 100 }, { opacity: 1, x: 0, duration: 0.6 });
          gsap.fromTo(cards[1], { opacity: 0, y: 100, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6 });
        },
      });

      kill = () => {
        st1.kill();
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
      };
    };

    init();

    return () => {
      if (kill) kill();
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative py-20 lg:py-32 bg-[#0A0A0F] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="h1-text text-center mb-16">Simple, transparent pricing</h2>
        <div className="grid md:grid-cols-3 gap-6 items-center">
          {plans.map((plan, i) => (
            <div
              key={plan.name}
              className={`pricing-card relative glass-card p-8 transition-all duration-200 ${
                plan.popular
                  ? "border-[#4F6EF7] scale-[1.05] z-10"
                  : "hover:translate-y-[-8px] hover:shadow-lg"
              }`}
              style={plan.popular ? { boxShadow: "0 0 20px #4F6EF740" } : undefined}
            >
              {plan.popular && (
                <>
                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none" style={{ background: "conic-gradient(from 0deg, transparent, #C9A84C40, transparent, #4F6EF740, transparent)", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", padding: "1px", animation: "gradient 4s linear infinite" }} />
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#C9A84C] text-[11px] font-semibold text-black tracking-[0.08em] uppercase whitespace-nowrap">Most Popular</div>
                </>
              )}
              <div className="relative z-1">
                <h3 className="text-[20px] font-semibold text-[#F0F0F8] mb-1">{plan.name}</h3>
                <p className="text-[13px] text-[#6B6B8A] mb-1">{plan.calls}</p>
                <div className="text-[36px] font-display font-bold text-[#F0F0F8] mt-6 mb-1">
                  {plan.price}
                  <span className="text-[15px] text-[#6B6B8A] font-sans font-normal">/mo</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-[14px] text-[#6B6B8A]">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <circle cx="8" cy="8" r="6" fill="#22D3A5" fillOpacity="0.2" />
                        <path d="M5 8l2 2 4-4" stroke="#22D3A5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={`block text-center py-3 px-6 rounded-lg mt-8 text-[15px] font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                    plan.popular
                      ? "bg-[#4F6EF7] text-white brand-glow"
                      : "border border-[#2A2A3A] text-[#F0F0F8] hover:bg-[#111118]"
                  }`}
                >
                  Request Your City
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

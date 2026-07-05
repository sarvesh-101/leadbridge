"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { TrendingUp, Users, IndianRupee, Calendar } from "lucide-react";

const scenarios = [
  {
    label: "Your Current Setup",
    telecallers: 2,
    costPerTelecaller: 25000,
    leadsPerMonth: 400,
    bookingsPerMonth: 12,
    color: "#F43F5E",
  },
  {
    label: "With LeadBridge",
    telecallers: 0,
    costPerTelecaller: 0,
    leadsPerMonth: 400,
    bookingsPerMonth: 36,
    color: "#22D3A5",
  },
];

export default function ROISection() {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });
  const [animated, setAnimated] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView || animated) return;
    setAnimated(true);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const bars = chartRef.current?.querySelectorAll(".bar-fill");
      if (!bars) return;

      gsap.fromTo(bars,
        { height: "0%" },
        {
          height: "100%", duration: 0.8, stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: chartRef.current,
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
  }, [inView, animated]);

  const currentCost = scenarios[0].telecallers * scenarios[0].costPerTelecaller;
  const bridgeCost = 35000; // Growth plan
  const monthlySavings = currentCost - bridgeCost;
  const annualSavings = monthlySavings * 12;
  const bookingIncrease = ((scenarios[1].bookingsPerMonth - scenarios[0].bookingsPerMonth) / scenarios[0].bookingsPerMonth) * 100;

  const stats = [
    {
      icon: IndianRupee,
      value: `₹${(monthlySavings / 1000).toFixed(0)}K`,
      label: "Monthly savings",
      subtext: `vs ${scenarios[0].telecallers} telecallers`,
      positive: true,
    },
    {
      icon: IndianRupee,
      value: `₹${(annualSavings / 100000).toFixed(1)}L`,
      label: "Annual savings",
      subtext: "every year, guaranteed",
      positive: true,
    },
    {
      icon: TrendingUp,
      value: `+${bookingIncrease.toFixed(0)}%`,
      label: "More bookings",
      subtext: `${scenarios[1].bookingsPerMonth}/mo vs ${scenarios[0].bookingsPerMonth}/mo`,
      positive: true,
    },
    {
      icon: Calendar,
      value: "24/7",
      label: "Calling hours",
      subtext: "Never miss a lead again",
      positive: true,
    },
  ];

  return (
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0A0A0F]" id="roi">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#22D3A5] mb-4 block">ROI CALCULATOR</span>
          <h2 className="h1-text mb-4">See how much you save</h2>
          <p className="text-[16px] text-[#6B6B8A] max-w-[520px] mx-auto">
            Replace telecallers with AI and get 3x more bookings at half the cost.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="p-5 rounded-xl bg-[#111118] border border-[#2A2A3A] text-center">
                <div className={`w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center ${
                  stat.positive ? "bg-[#22D3A5]/10" : "bg-[#F43F5E]/10"
                }`}>
                  <Icon className={`w-5 h-5 ${stat.positive ? "text-[#22D3A5]" : "text-[#F43F5E]"}`} />
                </div>
                <p className="text-[24px] font-display font-bold text-[#F0F0F8]">{stat.value}</p>
                <p className="text-[12px] text-[#6B6B8A] mt-1">{stat.label}</p>
                <p className="text-[11px] text-[#3A3A52] mt-0.5">{stat.subtext}</p>
              </div>
            );
          })}
        </div>

        {/* Bar Chart Comparison */}
        <div ref={chartRef} className="rounded-2xl bg-[#111118] border border-[#2A2A3A] p-8">
          <h3 className="text-[15px] font-semibold text-[#F0F0F8] mb-8 text-center">
            Monthly cost comparison
          </h3>

          <div className="flex items-end justify-center gap-16 h-[200px]">
            {/* Current Setup */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[28px] font-display font-bold text-[#F43F5E]">₹{currentCost.toLocaleString()}</span>
              <div className="relative w-16" style={{ height: "160px" }}>
                <div
                  className="bar-fill absolute bottom-0 left-0 right-0 rounded-t-lg bg-gradient-to-t from-[#F43F5E] to-[#F43F5E]/60"
                  style={{ height: animated ? "100%" : "0%" }}
                />
                {/* Telecaller icons */}
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex gap-1">
                  {Array.from({ length: scenarios[0].telecallers }).map((_, i) => (
                    <div key={i} className="w-6 h-6 rounded-full bg-[#F43F5E]/20 flex items-center justify-center">
                      <Users className="w-3 h-3 text-[#F43F5E]" />
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[12px] text-[#6B6B8A] text-center">{scenarios[0].label}</p>
            </div>

            {/* Arrow */}
            <div className="flex items-center self-center pb-8">
              <TrendingUp className="w-8 h-8 text-[#22D3A5]" />
            </div>

            {/* LeadBridge */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[28px] font-display font-bold text-[#22D3A5]">₹{bridgeCost.toLocaleString()}</span>
              <div className="relative w-16" style={{ height: "160px" }}>
                <div
                  className="bar-fill absolute bottom-0 left-0 right-0 rounded-t-lg bg-gradient-to-t from-[#22D3A5] to-[#22D3A5]/60"
                  style={{ height: animated ? `${(bridgeCost / currentCost) * 100}%` : "0%" }}
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-6 h-6 rounded-full bg-[#22D3A5]/20 flex items-center justify-center">
                    <Users className="w-3 h-3 text-[#22D3A5]" />
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-[#6B6B8A] text-center">{scenarios[1].label}</p>
            </div>
          </div>

          {/* Savings highlight */}
          <div className="mt-10 pt-6 border-t border-[#2A2A3A] text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#22D3A5]/10 border border-[#22D3A5]/20">
              <IndianRupee className="w-4 h-4 text-[#22D3A5]" />
              <span className="text-[13px] font-semibold text-[#22D3A5]">
                Save ₹{(monthlySavings / 1000).toFixed(0)}K/mo — that&apos;s ₹{(annualSavings / 100000).toFixed(1)}L/year
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

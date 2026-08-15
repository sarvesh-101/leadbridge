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
    color: "#10B981",
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
      label: "Projected annual savings",
      subtext: "based on the scenario above",
      positive: true,
    },
    {
      icon: TrendingUp,
      value: `+${bookingIncrease.toFixed(0)}%`,
      label: "More bookings (example)",
      subtext: `${scenarios[1].bookingsPerMonth}/mo vs ${scenarios[0].bookingsPerMonth}/mo — in this scenario`,
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
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0B0D12]" id="roi">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#10B981] mb-4 block">ROI CALCULATOR</span>
          <h2 className="h1-text mb-4">See how much you save</h2>
          <p className="text-[16px] text-[#8B93A3] max-w-[520px] mx-auto">
            Estimate the impact of replacing telecallers with AI — based on the example scenario below.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="p-5 rounded-xl bg-[#14161C] border border-[#272B34] text-center">
                <div className={`w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center ${
                  stat.positive ? "bg-[#10B981]/10" : "bg-[#F43F5E]/10"
                }`}>
                  <Icon className={`w-5 h-5 ${stat.positive ? "text-[#10B981]" : "text-[#F43F5E]"}`} />
                </div>
                <p className="text-[24px] font-display font-bold text-[#F2F4F8]">{stat.value}</p>
                <p className="text-[12px] text-[#8B93A3] mt-1">{stat.label}</p>
                <p className="text-[11px] text-[#363B45] mt-0.5">{stat.subtext}</p>
              </div>
            );
          })}
        </div>

        {/* Phase 2.1: label the example assumptions — results vary by broker */}
        <div className="mb-8 p-4 rounded-xl bg-[#14161C] border border-[#272B34] flex items-start gap-3">
          <span className="text-[16px] mt-0.5">ℹ️</span>
          <p className="text-[12px] text-[#8B93A3] leading-relaxed">
            <strong className="text-[#F2F4F8]">Illustrative calculator — assumptions:</strong>{" "}
            400 leads/month, 2 telecallers at ₹25,000/month each, and 12 vs 36 bookings/month. These
            are example inputs, not a promise. Results vary by broker, market and lead flow.
          </p>
        </div>

        {/* Bar Chart Comparison */}
        <div ref={chartRef} className="rounded-2xl bg-[#14161C] border border-[#272B34] p-8">
          <h3 className="text-[15px] font-semibold text-[#F2F4F8] mb-8 text-center">
            Monthly cost comparison
          </h3>

          <div className="flex items-end justify-center gap-16 h-[200px]">
            {/* Current Setup */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[28px] font-display font-bold text-[#F43F5E]">₹{currentCost.toLocaleString()}</span>
              <div className="relative w-16" style={{ height: "160px" }}>
                <div
                  className="bar-fill absolute bottom-0 left-0 right-0 rounded-t-lg bg-[#F43F5E]"
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
              <p className="text-[12px] text-[#8B93A3] text-center">{scenarios[0].label}</p>
            </div>

            {/* Arrow */}
            <div className="flex items-center self-center pb-8">
              <TrendingUp className="w-8 h-8 text-[#10B981]" />
            </div>

            {/* LeadBridge */}
            <div className="flex flex-col items-center gap-3">
              <span className="text-[28px] font-display font-bold text-[#10B981]">₹{bridgeCost.toLocaleString()}</span>
              <div className="relative w-16" style={{ height: "160px" }}>
                <div
                  className="bar-fill absolute bottom-0 left-0 right-0 rounded-t-lg bg-[#10B981]"
                  style={{ height: animated ? `${(bridgeCost / currentCost) * 100}%` : "0%" }}
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                  <div className="w-6 h-6 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                    <Users className="w-3 h-3 text-[#10B981]" />
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-[#8B93A3] text-center">{scenarios[1].label}</p>
            </div>
          </div>

          {/* Savings highlight */}
          <div className="mt-10 pt-6 border-t border-[#272B34] text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#10B981]/10 border border-[#10B981]/20">
              <IndianRupee className="w-4 h-4 text-[#10B981]" />
              <span className="text-[13px] font-semibold text-[#10B981]">
                Illustrative: ₹{(monthlySavings / 1000).toFixed(0)}K/mo saved in this scenario — ₹{(annualSavings / 100000).toFixed(1)}L/year
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

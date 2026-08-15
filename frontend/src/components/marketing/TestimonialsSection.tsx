"use client";

import { Star, ShieldCheck } from "lucide-react";
import { useLandingData } from "@/hooks/useLandingData";

export default function TestimonialsSection() {
  const { data, loaded } = useLandingData();
  const stats = data?.stats ?? null;

  return (
    <section className="relative py-20 lg:py-32 bg-[#0B0D12]" id="testimonials">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#C9A84C] mb-4 block">EARLY ACCESS</span>
          <h2 className="h1-text mb-4">We&apos;re onboarding our first brokers</h2>
          <p className="text-[16px] text-[#8B93A3] max-w-[560px] mx-auto">
            We&apos;re not going to pretend we have thousands of customers yet. We&apos;re onboarding
            one broker per city — and we&apos;d rather have 10 brokers who love us than 10,000 who
            don&apos;t. Here&apos;s exactly where we stand:
          </p>
        </div>

        {/* Real, honest stats — straight from the database */}
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                value: loaded && stats ? String(stats.activeBrokers) : "—",
                label: "Active Brokers",
                note: stats?.activeBrokers === 0 ? "You could be #1" : undefined,
              },
              {
                value: loaded && stats ? String(stats.callsMade) : "—",
                label: "Calls Made",
                note: stats?.callsMade === 0 ? "First call coming" : undefined,
              },
              {
                value: loaded && stats ? String(stats.visitsBooked) : "—",
                label: "Visits Booked",
                note: undefined,
              },
              {
                value: loaded && stats ? String(stats.citiesClaimed) : "—",
                label: "Cities Claimed",
                note: stats?.citiesClaimed === 0 ? "Every city open" : undefined,
              },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-lg bg-[#14161C] border border-[#272B34]">
                <p className="text-[28px] font-display font-bold text-[#F2F4F8]">{stat.value}</p>
                <p className="text-[12px] text-[#8B93A3] mt-1">{stat.label}</p>
                {stat.note && <p className="text-[11px] text-[#10B981] mt-0.5">{stat.note}</p>}
              </div>
            ))}
          </div>

          <p className="text-[12px] text-[#363B45] text-center mt-3 font-mono">
            {loaded
              ? "Live counts from our platform — updated in real time."
              : "Connecting to live data…"}
          </p>
        </div>

        {/* Honest promise instead of fake testimonials */}
        <div className="relative max-w-3xl mx-auto mt-14">
          <div className="relative p-8 md:p-10 rounded-2xl bg-gradient-to-br from-[#14161C] to-[#1B1E26] border border-[#272B34]">
            <ShieldCheck className="absolute top-6 left-6 w-8 h-8 text-[#10B981]/30" />

            <div className="flex items-center gap-1 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#C9A84C] text-[#C9A84C]" />
              ))}
            </div>

            <p className="text-[16px] md:text-[18px] text-[#F2F4F8] leading-relaxed mb-8">
              &ldquo;We&apos;re in the onboarding phase, and we&apos;d rather be upfront than
              impressive. The AI calling engine works — we&apos;ve tested it with real agents and
              real leads. What we don&apos;t have yet are hundreds of testimonials, because we&apos;re
              deliberately growing city by city. Be one of the first brokers, and help us write the
              stories every future broker will read.&rdquo;
            </p>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#3B82F6]/60 flex items-center justify-center text-white text-[16px] font-semibold">
                LB
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#F2F4F8]">The LeadBridge Team</p>
                <p className="text-[13px] text-[#8B93A3]">Founding team — we answer every message ourselves</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

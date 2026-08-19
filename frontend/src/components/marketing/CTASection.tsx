"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useLandingData } from "@/hooks/useLandingData";

const GlobeCanvas = dynamic(() => import("@/components/canvas/GlobeCanvas"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

export default function CTASection() {
  const { data } = useLandingData();
  const stats = data?.stats ?? null;

  const urgencyLine =
    stats && stats.citiesClaimed > 0
      ? `🏙️  ${stats.citiesClaimed} city${stats.citiesClaimed === 1 ? "" : "s"} already claimed — ${stats.citiesAvailable} still open. First come, first locked.`
      : "🏙️  Every city is still open. Be the first broker to claim yours.";

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0F0C]">
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#34D399] opacity-[0.08] blur-[130px]" />
        <div className="absolute top-[-100px] right-[-80px] w-[400px] h-[400px] rounded-full bg-[#E8C468] opacity-[0.06] blur-[110px]" />
        <div className="absolute inset-0 bg-grid-dark opacity-50" />
        <div className="absolute inset-0 bg-grain" />
      </div>

      {/* Globe - bottom center, half cropped */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-70 pointer-events-none">
        <GlobeCanvas />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="hero-text leading-[0.95] mb-6">
          Your city is
          <br />
          <span className="text-gradient-emerald">still available.</span>
        </h2>

        <p className="text-[18px] text-[#9FB0A6] max-w-[540px] mx-auto mb-12">
          We&apos;re onboarding one broker per city. Request yours before someone else does.
        </p>

        <div className="flex justify-center mb-8">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-[20px] font-bold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            style={{ height: "64px", boxShadow: "0 0 32px rgba(52, 211, 153, 0.4)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 64px rgba(52, 211, 153, 0.7)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 0 32px rgba(52, 211, 153, 0.4)";
            }}
          >
            Request Your City
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M4.167 10h11.666M10 4.167L15.833 10 10 15.833"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>

        {/* Real urgency line (live from DB, no fake timestamps) */}
        <div className="text-[13px] text-[#9FB0A6] font-mono">
          {urgencyLine}
        </div>
      </div>
    </section>
  );
}

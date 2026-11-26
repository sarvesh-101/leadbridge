"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useLandingData } from "@/hooks/useLandingData";

const LeadPulseCanvas = dynamic(() => import("@/components/canvas/LeadPulseCanvas"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

export default function CTASection() {
  const { data } = useLandingData();
  const stats = data?.stats ?? null;

  const urgencyLine =
    stats && stats.citiesClaimed > 0
      ? `🏙️  ${stats.citiesClaimed} zone${stats.citiesClaimed === 1 ? "" : "s"} already claimed — ${stats.citiesAvailable} still open.`
      : "🏙️  Every zone is still open. Be the first broker to claim yours.";

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-canvas">
      {/* Subtle orange glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-brand opacity-[0.06] blur-[130px]" />
        <div className="absolute inset-0 bg-grid-dark opacity-50" />
        <div className="absolute inset-0 bg-grain" />
      </div>

      {/* Globe - bottom center, half cropped */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-70 pointer-events-none">
        <LeadPulseCanvas scale={1.4} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="hero-text leading-[0.95] mb-6">
          Your zone is still available.
          <br />
          <span className="text-accent">Be the first broker to claim yours.</span>
        </h2>

        <p className="text-[18px] text-ink-soft max-w-[540px] mx-auto mb-12">
          We&apos;re onboarding our first brokers. Start free and see your own numbers.
        </p>

        <div className="flex justify-center mb-8">
          <Link
            href="/auth/register"
            className="btn-accent inline-flex items-center gap-3 px-10 py-4 text-[18px] font-bold"
          >
            Claim your zone
            <svg
              width="18"
              height="18"
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
        <div className="text-[13px] text-ink-soft font-mono">
          {urgencyLine}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const GlobeCanvas = dynamic(() => import("@/components/canvas/GlobeCanvas"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

const claimCities = [
  "Mumbai - Andheri West was claimed 2 hours ago",
  "Pune - Baner was claimed 4 hours ago",
  "Delhi - Dwarka was claimed 30 minutes ago",
  "Bangalore - Whitefield was claimed 1 hour ago",
  "Hyderabad - Gachibowli was claimed 3 hours ago",
];

export default function CTASection() {
  const [cityIndex, setCityIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Cycle through cities every 4 seconds with fade
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCityIndex((prev) => (prev + 1) % claimCities.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0A0F]">
      {/* Radial gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#4F6EF7] opacity-[0.03] blur-[120px]" />
      </div>

      {/* Globe - bottom center, half cropped */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-60 pointer-events-none">
        <GlobeCanvas />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="hero-text leading-[0.95] mb-6">
          Your city is
          <br />
          still available.
        </h2>

        <p className="text-[18px] text-[#6B6B8A] max-w-[540px] mx-auto mb-12">
          We&apos;re onboarding one broker per city. Request yours before someone else does.
        </p>

        <div className="flex justify-center mb-8">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-3 px-10 py-4 rounded-lg bg-[#4F6EF7] text-white text-[20px] font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            style={{ height: "64px", boxShadow: "0 0 32px #4F6EF740" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 64px rgba(79, 110, 247, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 0 32px rgba(79, 110, 247, 0.25)";
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

        {/* Urgency line */}
        <div
          className="text-[13px] text-[#6B6B8A] font-mono transition-opacity duration-400"
          style={{ opacity: visible ? 1 : 0 }}
        >
          ⚡  {claimCities[cityIndex]}
        </div>
      </div>
    </section>
  );
}

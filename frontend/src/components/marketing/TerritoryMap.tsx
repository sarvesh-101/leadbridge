"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { useLandingData } from "@/hooks/useLandingData";

interface City {
  name: string;
  x: number;
  y: number;
  status: "available" | "taken";
}

// Approximate geographic positions for the India map (visual only —
// statuses come from the real database via /public/landing)
const cityPositions: Record<string, { x: number; y: number }> = {
  Mumbai: { x: 220, y: 340 },
  Pune: { x: 240, y: 370 },
  Delhi: { x: 275, y: 160 },
  Bangalore: { x: 275, y: 450 },
  Chennai: { x: 290, y: 430 },
  Hyderabad: { x: 280, y: 385 },
  Kolkata: { x: 330, y: 210 },
  Ahmedabad: { x: 200, y: 200 },
  Jaipur: { x: 240, y: 200 },
  Lucknow: { x: 290, y: 220 },
  Surat: { x: 215, y: 260 },
  Indore: { x: 230, y: 270 },
  Bhopal: { x: 255, y: 280 },
  Nagpur: { x: 280, y: 310 },
  Chandigarh: { x: 255, y: 130 },
  Goa: { x: 215, y: 390 },
  Coimbatore: { x: 270, y: 475 },
  Kochi: { x: 255, y: 500 },
  Vadodara: { x: 210, y: 240 },
  Visakhapatnam: { x: 310, y: 360 },
  Thane: { x: 225, y: 335 },
  Nashik: { x: 230, y: 320 },
  Aurangabad: { x: 245, y: 335 },
  Rajkot: { x: 185, y: 240 },
  Guwahati: { x: 365, y: 170 },
};

export default function TerritoryMap() {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });
  const { data, loaded } = useLandingData();
  const [hoveredCity, setHoveredCity] = useState<City | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const dotsRef = useRef<SVGGElement>(null);

  const stats = data?.stats ?? null;

  // Build the real city list from the shared landing data
  useEffect(() => {
    const real = (data?.territories ?? []).map((t) => ({
      name: t.city,
      x: cityPositions[t.city]?.x ?? 250,
      y: cityPositions[t.city]?.y ?? 300,
      status: t.status,
    }));
    // Dedupe by name
    const byName = new Map<string, City>();
    for (const c of real) byName.set(c.name.toLowerCase(), c);
    setCities(Array.from(byName.values()));
  }, [data]);

  useEffect(() => {
    if (!inView || cities.length === 0) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const dots = dotsRef.current?.querySelectorAll(".city-dot");
      if (!dots) return;
      gsap.fromTo(
        dots,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.4, stagger: 0.03, ease: "back.out(1.7)" }
      );
      kill = () => {
        gsap.killTweensOf(dots);
      };
    };

    init();

    return () => {
      if (kill) kill();
    };
  }, [inView, cities]);

  return (
    <section className="relative py-20 lg:py-32 bg-[#0A0F0C] overflow-hidden" ref={ref}>
      {/* emerald glow behind the map */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full bg-[#1B4332] opacity-30 blur-[140px] pointer-events-none" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <h2 className="h1-text mb-4">One broker per city.</h2>
        <p className="text-[15px] text-[#9FB0A6] max-w-[520px] mx-auto mb-12">
          {loaded && stats !== null && stats.totalCitiesTracked > 0
            ? `Live from our database — ${stats.citiesClaimed} city claimed, ${stats.citiesAvailable} still open.`
            : "Territory status updates live from our database as brokers onboard."}
        </p>
        <div className="relative inline-block">
          <svg viewBox="110 80 320 480" className="w-full max-w-[500px] mx-auto" xmlns="http://www.w3.org/2000/svg">
            <path d="M140 120 L160 100 L200 105 L240 80 L280 90 L310 100 L340 110 L360 130 L380 160 L390 190 L400 210 L395 240 L390 260 L380 280 L370 300 L360 320 L350 340 L340 360 L330 380 L320 400 L310 420 L300 440 L290 460 L280 480 L270 490 L260 500 L250 510 L240 500 L230 490 L220 480 L210 470 L200 460 L190 450 L180 440 L170 430 L160 410 L150 390 L140 370 L130 350 L125 330 L120 310 L115 290 L110 270 L115 250 L120 230 L125 210 L130 190 L135 170 L140 150 Z" fill="none" stroke="#2A3B33" strokeWidth="1.5" />
            <path d="M180 180 L220 180" stroke="#1C2823" strokeWidth="1" />
            <path d="M160 250 L280 250" stroke="#1C2823" strokeWidth="1" />
            <path d="M200 320 L340 320" stroke="#1C2823" strokeWidth="1" />
            <path d="M200 140 L200 480" stroke="#1C2823" strokeWidth="1" />
            <path d="M280 80 L280 500" stroke="#1C2823" strokeWidth="1" />
            <g ref={dotsRef}>
              {cities.map((city, i) => (
                <g key={`${city.name}-${i}`}>
                  <circle
                    className="city-dot"
                    cx={city.x}
                    cy={city.y}
                    r={city.status === "taken" ? 5 : 4}
                    fill={city.status === "taken" ? "#34D399" : "#5C6B62"}
                    style={{ cursor: "pointer", opacity: 0 }}
                    onMouseEnter={() => setHoveredCity(city)}
                    onMouseLeave={() => setHoveredCity(null)}
                  />
                  {city.status === "taken" && (
                    <circle cx={city.x} cy={city.y} r={8} fill="none" stroke="#34D399" strokeWidth="1" opacity="0.4" className="animate-sonar-ring" style={{ animationDelay: `${i * 0.1}s` }} />
                  )}
                </g>
              ))}
            </g>
          </svg>
          {hoveredCity && (
            <div className="absolute z-10 pointer-events-none inset-0 flex items-start justify-center pt-4">
              <div className="px-3 py-2 rounded glass-card text-[13px] whitespace-nowrap">
                <span className="text-[#F0F7F3] font-medium">{hoveredCity.name}</span>
                <span className={`ml-2 ${hoveredCity.status === "taken" ? "text-[#6FE3B0]" : "text-[#34D399]"}`}>
                  {hoveredCity.status === "taken" ? "Claimed" : "Available"}
                </span>
              </div>
            </div>
          )}
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] text-[#6B7C73] font-mono">Loading territory data…</span>
            </div>
          )}
          {loaded && cities.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] text-[#6B7C73] font-mono max-w-[260px]">
                No territory data yet — every city is available. Be the first to claim yours.
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-12">
          <div className="px-6 py-3 rounded-full glass-card text-[14px] text-[#9FB0A6] font-mono">
            <span className="text-[#F0F7F3] font-semibold">{stats?.totalCitiesTracked ?? "—"}</span> cities tracked
          </div>
          <div className="px-6 py-3 rounded-full glass-card text-[14px] text-[#9FB0A6] font-mono">
            <span className="text-[#6FE3B0] font-semibold">{stats?.citiesClaimed ?? "—"}</span> claimed
          </div>
          <div className="px-6 py-3 rounded-full glass-card text-[14px] text-[#9FB0A6] font-mono">
            <span className="text-[#34D399] font-semibold">{stats?.citiesAvailable ?? "—"}</span> available
          </div>
        </div>
      </div>
    </section>
  );
}

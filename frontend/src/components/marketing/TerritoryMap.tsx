"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

interface City {
  name: string;
  x: number;
  y: number;
  status: "available" | "taken";
}

const cities: City[] = [
  { name: "Mumbai", x: 220, y: 340, status: "taken" },
  { name: "Pune", x: 240, y: 370, status: "taken" },
  { name: "Delhi", x: 275, y: 160, status: "available" },
  { name: "Bangalore", x: 275, y: 450, status: "taken" },
  { name: "Chennai", x: 290, y: 430, status: "available" },
  { name: "Hyderabad", x: 280, y: 385, status: "taken" },
  { name: "Kolkata", x: 330, y: 210, status: "available" },
  { name: "Ahmedabad", x: 200, y: 200, status: "available" },
  { name: "Jaipur", x: 240, y: 200, status: "available" },
  { name: "Lucknow", x: 290, y: 220, status: "available" },
  { name: "Surat", x: 215, y: 260, status: "taken" },
  { name: "Indore", x: 230, y: 270, status: "available" },
  { name: "Bhopal", x: 255, y: 280, status: "available" },
  { name: "Nagpur", x: 280, y: 310, status: "taken" },
  { name: "Chandigarh", x: 255, y: 130, status: "available" },
  { name: "Goa", x: 215, y: 390, status: "available" },
  { name: "Coimbatore", x: 270, y: 475, status: "available" },
  { name: "Kochi", x: 255, y: 500, status: "available" },
  { name: "Vadodara", x: 210, y: 240, status: "available" },
  { name: "Visakhapatnam", x: 310, y: 360, status: "available" },
  { name: "Thane", x: 225, y: 335, status: "taken" },
  { name: "Nashik", x: 230, y: 320, status: "available" },
  { name: "Aurangabad", x: 245, y: 335, status: "available" },
  { name: "Rajkot", x: 185, y: 240, status: "available" },
  { name: "Guwahati", x: 365, y: 170, status: "available" },
];

export default function TerritoryMap() {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });
  const [hoveredCity, setHoveredCity] = useState<City | null>(null);
  const [availableCount, setAvailableCount] = useState(847);
  const dotsRef = useRef<SVGGElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!inView) return;

    intervalRef.current = setInterval(() => {
      setAvailableCount((prev) => Math.max(0, prev - 1));
    }, 45000);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
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
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (kill) kill();
    };
  }, [inView]);

  const handleDotHover = (city: City) => {
    setHoveredCity(city);
  };

  return (
    <section className="relative py-20 lg:py-32 bg-[#0A0A0F]" ref={ref}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="h1-text mb-16">1,500 cities. One broker each.</h2>
        <div className="relative inline-block">
          <svg viewBox="110 80 320 480" className="w-full max-w-[500px] mx-auto" xmlns="http://www.w3.org/2000/svg">
            <path d="M140 120 L160 100 L200 105 L240 80 L280 90 L310 100 L340 110 L360 130 L380 160 L390 190 L400 210 L395 240 L390 260 L380 280 L370 300 L360 320 L350 340 L340 360 L330 380 L320 400 L310 420 L300 440 L290 460 L280 480 L270 490 L260 500 L250 510 L240 500 L230 490 L220 480 L210 470 L200 460 L190 450 L180 440 L170 430 L160 410 L150 390 L140 370 L130 350 L125 330 L120 310 L115 290 L110 270 L115 250 L120 230 L125 210 L130 190 L135 170 L140 150 Z" fill="none" stroke="#2A2A3A" strokeWidth="1.5" />
            <path d="M180 180 L220 180" stroke="#1A1A24" strokeWidth="1" />
            <path d="M160 250 L280 250" stroke="#1A1A24" strokeWidth="1" />
            <path d="M200 320 L340 320" stroke="#1A1A24" strokeWidth="1" />
            <path d="M200 140 L200 480" stroke="#1A1A24" strokeWidth="1" />
            <path d="M280 80 L280 500" stroke="#1A1A24" strokeWidth="1" />
            <g ref={dotsRef}>
              {cities.map((city, i) => (
                <g key={i}>
                  <circle
                    className="city-dot"
                    cx={city.x}
                    cy={city.y}
                    r={city.status === "taken" ? 5 : 4}
                    fill={city.status === "taken" ? "#4F6EF7" : "#3A3A52"}
                    style={{ cursor: "pointer", opacity: 0 }}
                    onMouseEnter={() => handleDotHover(city)}
                    onMouseLeave={() => setHoveredCity(null)}
                  />
                  {city.status === "taken" && (
                    <circle cx={city.x} cy={city.y} r={8} fill="none" stroke="#4F6EF7" strokeWidth="1" opacity="0.3" className="animate-sonar-ring" style={{ animationDelay: `${i * 0.1}s` }} />
                  )}
                </g>
              ))}
            </g>
          </svg>
          {hoveredCity && (
            <div className="absolute z-10 pointer-events-none inset-0 flex items-start justify-center pt-4">
              <div className="px-3 py-2 rounded border border-[#2A2A3A] bg-[#111118] text-[13px] whitespace-nowrap">
                <span className="text-[#F0F0F8] font-medium">{hoveredCity.name}</span>
                <span className={`ml-2 ${hoveredCity.status === "taken" ? "text-[#4F6EF7]" : "text-[#22D3A5]"}`}>
                  {hoveredCity.status === "taken" ? "Taken" : "Available"}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mt-12">
          <div className="px-6 py-3 rounded-full border border-[#2A2A3A] bg-[#111118] text-[14px] text-[#6B6B8A] font-mono">
            <span className="text-[#F0F0F8] font-semibold">1,500</span> cities total
          </div>
          <div className="px-6 py-3 rounded-full border border-[#2A2A3A] bg-[#111118] text-[14px] text-[#6B6B8A] font-mono animate-countdown-pulse">
            <span className="text-[#22D3A5] font-semibold">{availableCount}</span> still available
          </div>
        </div>
      </div>
    </section>
  );
}

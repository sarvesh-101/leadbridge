"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

const painPoints = [
  "Average broker response time: 4–8 hours",
  "JustDial leads expire in under 6 minutes of interest",
  "Your telecaller handles 40 calls. You get 200 leads.",
];

export default function ProblemSection() {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView({ threshold: 0.3, triggerOnce: true });
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView) return;
    const duration = 2000;
    const steps = 60;
    const increment = 73 / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= 73) {
        setCount(73);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [inView]);

  useEffect(() => {
    if (!inView) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: timelineRef.current,
          start: "top 70%",
          toggleActions: "play none none none",
        },
      });

      tl.fromTo(
        ".lead-dot",
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.4 }
      )
        .fromTo(
          ".line-down-1",
          { strokeDashoffset: 100 },
          { strokeDashoffset: 0, duration: 0.6 },
          "-=0.2"
        )
        .fromTo(
          ".phone-icon",
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: 0.3 },
          "-=0.3"
        )
        .fromTo(
          ".missed-x",
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: 0.3 }
        )
        .fromTo(
          ".line-down-2",
          { strokeDashoffset: 100 },
          { strokeDashoffset: 0, duration: 0.6 },
          "-=0.1"
        )
        .fromTo(
          ".clock-icon",
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: 0.3 },
          "-=0.3"
        )
        .to(".clock-hand-minute", {
          rotation: 360,
          transformOrigin: "50% 50%",
          duration: 1,
          ease: "power1.inOut",
        }, "-=0.1")
        .to(".clock-hand-hour", {
          rotation: 30,
          transformOrigin: "50% 50%",
          duration: 1,
          ease: "power1.inOut",
        }, "-=1")
        .fromTo(
          ".line-down-3",
          { strokeDashoffset: 100 },
          { strokeDashoffset: 0, duration: 0.5 }
        )
        .fromTo(
          ".cold-label",
          { opacity: 0, scale: 0 },
          { opacity: 1, scale: 1, duration: 0.4 }
        )
        .to(".lead-dot", {
          fill: "#3A3A52",
          duration: 0.3,
        });

      kill = () => {
        tl.kill();
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
      };
    };

    init();

    return () => {
      if (kill) kill();
    };
  }, [inView]);

  return (
    <section className="relative py-20 lg:py-32 bg-[#0A0A0F]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column */}
          <div>
            <h2 className="h1-text mb-8">
              Right now, your leads are going cold.
            </h2>

            <div className="mb-10">
              <div className="text-[72px] font-display font-bold text-[#F0F0F8] leading-none mb-2">
                {count}%
              </div>
              <p className="body-text">
                of leads never get called back
              </p>
            </div>

            {/* Pain Points */}
            <div className="space-y-6">
              {painPoints.map((point, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 opacity-0"
                  style={{ animation: `fade-in 0.5s ease-out ${0.8 + i * 0.12}s forwards` }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="flex-shrink-0 mt-0.5"
                  >
                    <path
                      d="M10 18a8 8 0 100-16 8 8 0 000 16z"
                      stroke="#F43F5E"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M12.5 7.5l-5 5m0-5l5 5"
                      stroke="#F43F5E"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className="text-[15px] text-[#F0F0F8]">{point}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - SVG Death Animation */}
          <div ref={timelineRef} className="flex justify-center">
            <svg
              width="280"
              height="480"
              viewBox="0 0 280 480"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="lead-dot"
                cx="140"
                cy="30"
                r="16"
                fill="#4F6EF7"
              />
              <text
                x="140"
                y="35"
                textAnchor="middle"
                fill="#F0F0F8"
                fontSize="11"
                fontWeight="500"
              >
                LEAD
              </text>
              <path
                className="line-down-1"
                d="M140 46 L140 90 L100 90 L100 130"
                stroke="#2A2A3A"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                fill="none"
              />
              <circle
                className="phone-icon"
                cx="100"
                cy="160"
                r="24"
                fill="#111118"
                stroke="#2A2A3A"
                strokeWidth="1.5"
              />
              <rect
                x="90"
                y="145"
                width="20"
                height="30"
                rx="3"
                stroke="#6B6B8A"
                strokeWidth="1.5"
                fill="none"
              />
              <circle cx="100" cy="169" r="2" fill="#6B6B8A" />
              <path
                className="missed-x"
                d="M112 148 L120 156 M120 148 L112 156"
                stroke="#F43F5E"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                className="line-down-2"
                d="M100 184 L100 220 L140 220 L140 260"
                stroke="#2A2A3A"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                fill="none"
              />
              <circle
                className="clock-icon"
                cx="140"
                cy="290"
                r="24"
                fill="#111118"
                stroke="#2A2A3A"
                strokeWidth="1.5"
              />
              <circle cx="140" cy="290" r="18" stroke="#6B6B8A" strokeWidth="1.5" fill="none" />
              <line
                className="clock-hand-minute"
                x1="140"
                y1="290"
                x2="140"
                y2="276"
                stroke="#6B6B8A"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transformOrigin: "140px 290px" }}
              />
              <line
                className="clock-hand-hour"
                x1="140"
                y1="290"
                x2="148"
                y2="290"
                stroke="#6B6B8A"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transformOrigin: "140px 290px" }}
              />
              <path
                className="line-down-3"
                d="M140 314 L140 350 L140 390"
                stroke="#2A2A3A"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                fill="none"
              />
              <rect
                className="cold-label"
                x="110"
                y="410"
                width="60"
                height="30"
                rx="4"
                fill="#F43F5E"
                fillOpacity="0.15"
                stroke="#F43F5E"
                strokeWidth="1"
              />
              <text
                className="cold-label"
                x="140"
                y="430"
                textAnchor="middle"
                fill="#F43F5E"
                fontSize="14"
                fontWeight="700"
                letterSpacing="2"
              >
                COLD
              </text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

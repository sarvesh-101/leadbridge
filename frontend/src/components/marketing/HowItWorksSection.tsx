"use client";

import { useEffect, useRef, useState } from "react";

const slides = [
  {
    number: "01",
    title: "Lead comes in",
    body: "From 99acres, MagicBricks, Housing.com, or JustDial — we catch it instantly.",
    logos: ["99acres", "MagicBricks", "Housing.com", "JustDial"],
  },
  {
    number: "02",
    title: "AI calls within 60 seconds",
    body: "Before they've even clicked away. In Hinglish, naturally.",
    hasWaveform: true,
  },
  {
    number: "03",
    title: "Qualifies, answers, books",
    body: "Budget. Location. Timeline. Property type. All captured. Visit booked.",
    transcript: [
      { speaker: "AI", text: "Namaste! Main LeadBridge se bol raha hoon." },
      { speaker: "Lead", text: "Haan ji, maine online dekha tha." },
      { speaker: "AI", text: "Aap konse area mein dekh rahe hain?" },
      { speaker: "Lead", text: "Andheri West mein 2BHK chahiye." },
      { speaker: "AI", text: "Budget kya hai aapka?" },
      { speaker: "Lead", text: "1.2 crore ke around." },
      { speaker: "AI", text: "Kal 11AM pe site visit book kar deta hoon." },
    ],
  },
  {
    number: "04",
    title: "You get a WhatsApp",
    body: "Instant summary. Lead name, budget, visit time. Everything you need.",
    typewriterText: "New Visit Booked!\n\nRahul Sharma\nAndheri West · 2BHK\nBudget: ₹1.2Cr\nVisit: Tomorrow 11AM\n\nStatus: CONFIRMED ✅",
  },
  {
    number: "05",
    title: "Your city. Locked.",
    body: "One broker per territory. Your competitors can't use this.",
    hasMap: true,
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const slidesContainerRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [gsapReady, setGsapReady] = useState(false);
  const [gsapTimedOut, setGsapTimedOut] = useState(false);

  // Fallback: if GSAP hasn't activated within 3 seconds, show vertical layout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!gsapReady) {
        setGsapTimedOut(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [gsapReady]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const mod = await import("gsap");
      const st = await import("gsap/ScrollTrigger");
      const gsap = mod.gsap;
      const ScrollTrigger = st.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      const section = sectionRef.current;
      const slidesContainer = slidesContainerRef.current;
      if (!section || !slidesContainer) return;

      const totalSlides = slides.length;

      // Mark GSAP as ready BEFORE creating the timeline
      // This triggers the 500vh height, then immediately the pin takes over
      setGsapReady(true);

      // Wait for next paint frame so DOM has the new 500vh height before GSAP pins
      await new Promise((r) => requestAnimationFrame(r));

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          pin: true,
          start: "top top",
          end: `+=${totalSlides * 100}%`,
          scrub: 0.5,
          invalidateOnRefresh: true,
          onUpdate: (self: any) => {
            const progress = self.progress;
            const slideIndex = Math.min(
              Math.floor(progress * totalSlides),
              totalSlides - 1
            );
            setActiveSlide(slideIndex);
          },
        },
      });

      tl.to(slidesContainer, {
        x: () => -(totalSlides - 1) * section.clientWidth,
        ease: "none",
        duration: totalSlides - 1,
      });

      slides.forEach((_, i) => {
        const slide = slidesContainer.querySelectorAll(".slide-content")[i];
        const title = slide?.querySelector(".slide-title");
        const body = slide?.querySelector(".slide-body");

        if (title) {
          gsap.fromTo(
            title,
            { opacity: 0, y: 30 },
            {
              opacity: 1,
              y: 0,
              duration: 0.5,
              scrollTrigger: {
                trigger: section,
                start: `top top+=${i * section.clientHeight}`,
                end: `top top+=${(i + 0.5) * section.clientHeight}`,
                scrub: 0.5,
              },
            }
          );
        }

        if (body) {
          gsap.fromTo(
            body,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.5,
              scrollTrigger: {
                trigger: section,
                start: `top top+=${(i + 0.2) * section.clientHeight}`,
                end: `top top+=${(i + 0.7) * section.clientHeight}`,
                scrub: 0.5,
              },
            }
          );
        }
      });

      kill = () => {
        tl.kill();
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
        ScrollTrigger.refresh();
        setGsapReady(false);
      };
    };

    init();

    return () => {
      if (kill) kill();
    };
  }, [isMobile]);

  // Mobile: vertical layout
  if (isMobile) {
    return (
      <section className="relative py-16 bg-[#0A0A0F]">
        <h2 className="h1-text text-center px-4 mb-12">How It Works</h2>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="space-y-8">
            {slides.map((slide, i) => (
              <div key={i} className="relative p-6 rounded-lg bg-[#111118] border border-[#2A2A3A]">
                <span className="text-[48px] font-display font-bold text-[#3A3A52] leading-none block mb-3">
                  {slide.number}
                </span>
                <h3 className="text-[20px] font-display font-bold text-[#F0F0F8] mb-2">
                  {slide.title}
                </h3>
                <p className="text-[14px] text-[#6B6B8A] mb-4">
                  {slide.body}
                </p>
                {slide.logos && (
                  <div className="flex flex-wrap gap-2">
                    {slide.logos.map((logo) => (
                      <div key={logo} className="px-3 py-1.5 rounded border border-[#2A2A3A] bg-[#1A1A24] text-[12px] text-[#6B6B8A]">
                        {logo}
                      </div>
                    ))}
                  </div>
                )}
                {slide.hasWaveform && (
                  <div className="flex items-end gap-[2px] h-6 mt-3">
                    {Array.from({ length: 20 }).map((_, j) => (
                      <div key={j} className="w-[2px] bg-[#4F6EF7] rounded-full animate-waveform" style={{ height: `${Math.random() * 80 + 20}%`, animationDelay: `${j * 0.05}s` }} />
                    ))}
                  </div>
                )}
                {slide.transcript && (
                  <div className="space-y-1 mt-3">
                    {slide.transcript.slice(0, 4).map((msg, j) => (
                      <div key={j} className="flex gap-2 items-start">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${msg.speaker === "AI" ? "bg-[#1A1A24] text-[#4F6EF7]" : "bg-[#4F6EF740] text-[#4F6EF7]"}`}>
                          {msg.speaker}
                        </span>
                        <span className="text-[12px] text-[#F0F0F8]">{msg.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                {slide.typewriterText && (
                  <div className="p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] max-w-[280px] mt-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2A2A3A]">
                      <div className="w-6 h-6 rounded-full bg-[#22D3A5]/20 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#22D3A5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                      </div>
                      <span className="text-[12px] font-semibold text-[#F0F0F8]">WhatsApp</span>
                    </div>
                    {slide.typewriterText.split("\n").slice(0, 6).map((line, j) => (
                      <p key={j} className="text-[12px] text-[#F0F0F8]" style={{ fontWeight: line.includes(":") ? 400 : 600 }}>
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Desktop: horizontal scroll (fallback to vertical on GSAP timeout)
  if (gsapTimedOut) {
    return (
      <section className="relative py-16 bg-[#0A0A0F]">
        <h2 className="h1-text text-center px-4 mb-12">How It Works</h2>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="space-y-8">
            {slides.map((slide, i) => (
              <div key={i} className="relative p-6 rounded-lg bg-[#111118] border border-[#2A2A3A]">
                <span className="text-[48px] font-display font-bold text-[#3A3A52] leading-none block mb-3">
                  {slide.number}
                </span>
                <h3 className="text-[20px] font-display font-bold text-[#F0F0F8] mb-2">
                  {slide.title}
                </h3>
                <p className="text-[14px] text-[#6B6B8A] mb-4">{slide.body}</p>
                {slide.logos && (
                  <div className="flex flex-wrap gap-2">
                    {slide.logos.map((logo) => (
                      <div key={logo} className="px-3 py-1.5 rounded border border-[#2A2A3A] bg-[#1A1A24] text-[12px] text-[#6B6B8A]">{logo}</div>
                    ))}
                  </div>
                )}
                {slide.hasWaveform && (
                  <div className="flex items-end gap-[2px] h-6 mt-3">
                    {Array.from({ length: 20 }).map((_, j) => (
                      <div key={j} className="w-[2px] bg-[#4F6EF7] rounded-full" style={{ height: `${Math.random() * 80 + 20}%` }} />
                    ))}
                  </div>
                )}
                {slide.transcript && (
                  <div className="space-y-1 mt-3">
                    {slide.transcript.slice(0, 4).map((msg, j) => (
                      <div key={j} className="flex gap-2 items-start">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${msg.speaker === "AI" ? "bg-[#1A1A24] text-[#4F6EF7]" : "bg-[#4F6EF740] text-[#4F6EF7]"}`}>{msg.speaker}</span>
                        <span className="text-[12px] text-[#F0F0F8]">{msg.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                {slide.typewriterText && (
                  <div className="p-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] max-w-[280px] mt-3">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2A2A3A]">
                      <div className="w-6 h-6 rounded-full bg-[#22D3A5]/20 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#22D3A5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                      </div>
                      <span className="text-[12px] font-semibold text-[#F0F0F8]">WhatsApp</span>
                    </div>
                    {slide.typewriterText.split("\n").slice(0, 6).map((line, j) => (
                      <p key={j} className="text-[12px] text-[#F0F0F8]" style={{ fontWeight: line.includes(":") ? 400 : 600 }}>{line}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#0A0A0F]"
      style={{ height: gsapReady ? `${slides.length * 100}vh` : "100vh" }}
    >
      {/* Show a simple loading/minimal layout until GSAP is ready */}
      {!gsapReady && (
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <span className="text-[120px] font-display font-bold text-[#3A3A52] leading-none block mb-4">01</span>
            <h2 className="h1-text mb-4">How It Works</h2>
            <p className="text-[18px] text-[#6B6B8A] max-w-[480px] mx-auto">Scroll down to explore</p>
          </div>
        </div>
      )}

      <div
        ref={slidesContainerRef}
        className="flex h-screen"
        style={{ width: `${slides.length * 100}vw` }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="slide-content relative flex-shrink-0 flex items-center justify-center px-8 sm:px-16"
            style={{ width: "100vw", height: "100vh" }}
          >
            <div className="max-w-5xl mx-auto w-full">
              <span className="absolute top-12 left-8 sm:left-16 text-[120px] font-display font-bold text-[#3A3A52] leading-none">
                {slide.number}
              </span>
              <div className="mt-20 sm:mt-0">
                <h2 className="slide-title h1-text mb-6 opacity-0">{slide.title}</h2>
                <p className="slide-body text-[18px] text-[#6B6B8A] max-w-[520px] mb-10 opacity-0">{slide.body}</p>
                {slide.logos && (
                  <div className="flex flex-wrap gap-3 mt-8">
                    {slide.logos.map((logo) => (
                      <div key={logo} className="px-4 py-2 rounded border border-[#2A2A3A] bg-[#111118] text-[13px] text-[#6B6B8A] font-medium animate-float" style={{ animationDelay: `${i * 0.2}s` }}>
                        {logo}<span className="ml-2 text-[#22D3A5]">●</span>
                      </div>
                    ))}
                  </div>
                )}
                {slide.hasWaveform && (
                  <div className="flex items-end gap-[3px] h-10 mt-8">
                    {Array.from({ length: 40 }).map((_, j) => (
                      <div key={j} className="w-[3px] bg-[#4F6EF7] rounded-full animate-waveform" style={{ height: `${Math.random() * 80 + 20}%`, animationDelay: `${j * 0.05}s`, opacity: 0.5 + Math.random() * 0.5 }} />
                    ))}
                  </div>
                )}
                {slide.transcript && (
                  <div className="space-y-2 max-w-md mt-8">
                    {slide.transcript.map((msg, j) => (
                      <div key={j} className="flex gap-3 items-start animate-fade-in-up" style={{ animationDelay: `${j * 0.2}s` }}>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${msg.speaker === "AI" ? "bg-[#1A1A24] text-[#4F6EF7]" : "bg-[#4F6EF740] text-[#4F6EF7] border border-[#4F6EF7]"}`}>
                          {msg.speaker}
                        </span>
                        <span className="text-[14px] text-[#F0F0F8]">{msg.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                {slide.typewriterText && (
                  <div className="mt-8 p-4 rounded-lg bg-[#111118] border border-[#2A2A3A] max-w-[320px]">
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#2A2A3A]">
                      <div className="w-8 h-8 rounded-full bg-[#22D3A5]/20 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#22D3A5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                      </div>
                      <span className="text-[13px] font-semibold text-[#F0F0F8]">WhatsApp</span>
                    </div>
                    <div className="space-y-1">
                      {slide.typewriterText.split("\n").map((line, j) => (
                        <p key={j} className="text-[13px] text-[#F0F0F8] animate-fade-in" style={{ animationDelay: `${j * 0.3}s`, fontWeight: line.includes(":") ? 400 : 600, color: line.includes("✅") ? "#22D3A5" : undefined }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress Dots */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === activeSlide ? "bg-[#4F6EF7] w-6" : "bg-[#2A2A3A]"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

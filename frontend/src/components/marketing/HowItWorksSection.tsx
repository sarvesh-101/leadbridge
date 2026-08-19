"use client";

import { MotionConfig, motion } from "framer-motion";

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
  return (
    <MotionConfig reducedMotion="user">
    <section className="relative py-16 lg:py-24 bg-[#0A0F0C] overflow-hidden">
      {/* Soft radial glow behind the section */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[420px] bg-[#34D399]/10 blur-[120px] rounded-full"
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          className="text-center mb-12 lg:mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="h1-text px-4">How It Works</h2>
          <p className="mt-4 text-[16px] text-[#9FB0A6] max-w-[560px] mx-auto px-4">
            Five steps. Zero missed leads. From enquiry to confirmed site visit — on autopilot.
          </p>
        </motion.div>

        <div className="relative">
          {/* Vertical timeline line (desktop) */}
          <div
            aria-hidden
            className="hidden md:block absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-[#34D399]/50 via-[#1E2B24] to-transparent"
          />

          <div className="space-y-6 md:space-y-8">
            {slides.map((slide, i) => (
              <motion.div
                key={i}
                className="relative md:pl-20"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.55, delay: (i % 3) * 0.12, ease: "easeOut" }}
              >
                {/* Number node on the timeline */}
                <div
                  aria-hidden
                  className="hidden md:flex absolute left-0 top-6 w-14 h-14 rounded-2xl glass-card items-center justify-center shadow-[0_0_24px_rgba(52,211,153,0.15)]"
                >
                  <span className="text-[20px] font-display font-bold text-gradient-emerald leading-none">
                    {slide.number}
                  </span>
                </div>

                <div className="relative p-6 lg:p-8 rounded-2xl glass-card hover:border-[#34D399]/40 hover:shadow-[0_8px_40px_rgba(52,211,153,0.1)] transition-all duration-300">
                  <span className="md:hidden block text-[40px] font-display font-bold text-[#34D399]/50 leading-none mb-3">
                    {slide.number}
                  </span>
                  <h3 className="text-[20px] lg:text-[22px] font-display font-bold text-[#F0F7F3] mb-2">
                    {slide.title}
                  </h3>
                  <p className="text-[14px] text-[#9FB0A6] mb-4">
                    {slide.body}
                  </p>

                  {slide.logos && (
                    <div className="flex flex-wrap gap-2">
                      {slide.logos.map((logo) => (
                        <div
                          key={logo}
                          className="px-3 py-1.5 rounded border border-white/10 bg-white/[0.04] text-[12px] text-[#9FB0A6]"
                        >
                          {logo}
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.hasWaveform && (
                    <div className="flex items-end gap-[2px] h-6 mt-3">
                      {Array.from({ length: 20 }).map((_, j) => (
                        <div
                          key={j}
                          className="w-[2px] bg-[#34D399] rounded-full animate-waveform"
                          style={{
                            height: `${Math.random() * 80 + 20}%`,
                            animationDelay: `${j * 0.05}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {slide.transcript && (
                    <div className="space-y-1 mt-3">
                      {slide.transcript.slice(0, 4).map((msg, j) => (
                        <div key={j} className="flex gap-2 items-start">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                              msg.speaker === "AI"
                                ? "bg-[#34D399]/15 text-[#6FE3B0]"
                                : "bg-[#34D399]/5 text-[#9FB0A6]"
                            }`}
                          >
                            {msg.speaker}
                          </span>
                          <span className="text-[12px] text-[#D5E0D9]">
                            {msg.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.typewriterText && (
                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10 max-w-[280px] mt-3">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                        <div className="w-6 h-6 rounded-full bg-[#34D399]/20 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#34D399">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                          </svg>
                        </div>
                        <span className="text-[12px] font-semibold text-[#F0F7F3]">
                          WhatsApp
                        </span>
                      </div>
                      {slide.typewriterText
                        .split("\n")
                        .slice(0, 6)
                        .map((line, j) => (
                          <p
                            key={j}
                            className="text-[12px] text-[#D5E0D9]"
                            style={{ fontWeight: line.includes(":") ? 400 : 600 }}
                          >
                            {line}
                          </p>
                        ))}
                    </div>
                  )}

                  {slide.hasMap && (
                    <div className="flex items-center gap-2 mt-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="text-[12px] text-[#6FE3B0]">
                        Exclusively yours — one broker per territory
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
    </MotionConfig>
  );
}

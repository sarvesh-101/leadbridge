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
      { speaker: "AI", text: "Namaste! Main Converza se bol raha hoon." },
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
    body: "We won't onboard another Converza broker in your zone while your territory is active.",
    hasMap: true,
  },
];

export default function HowItWorksSection() {
  return (
    <MotionConfig reducedMotion="user">
    <section className="relative py-16 lg:py-24 bg-canvas overflow-hidden">
      {/* Subtle orange glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[420px] bg-brand/8 blur-[120px] rounded-full"
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
          <p className="mt-4 text-[16px] text-ink-soft max-w-[560px] mx-auto px-4">
            Five steps. Zero missed leads. From enquiry to confirmed site visit — on autopilot.
          </p>
        </motion.div>

        <div className="relative">
          {/* Vertical timeline line (desktop) */}
          <div
            aria-hidden
            className="hidden md:block absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-brand/50 via-surface to-transparent"
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
                {/* Number node on the timeline */}                <div aria-hidden
                  className="hidden md:flex absolute left-0 top-6 w-14 h-14 rounded-2xl surface-card items-center justify-center shadow-[0_0_24px_rgba(242,140,69,0.12)]"
                >
                  <span className="text-[20px] font-bold text-accent leading-none" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {slide.number}
                  </span>
                </div>                  <div className="relative p-6 lg:p-8 rounded-2xl surface-card hover:border-brand-copper hover:shadow-[0_8px_40px_rgba(242,140,69,0.06)] transition-all duration-300">
                  <span className="md:hidden block text-[40px] font-bold text-brand/50 leading-none mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {slide.number}
                  </span>
                  <h3 className="text-[20px] lg:text-[22px] font-bold text-ink mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {slide.title}
                  </h3>
                  <p className="text-[14px] text-ink-soft mb-4">
                    {slide.body}
                  </p>

                  {slide.logos && (
                    <div className="flex flex-wrap gap-2">
                      {slide.logos.map((logo) => (
                        <div
                          key={logo}
                          className="px-3 py-1.5 rounded border border-line bg-white/[0.02] text-[12px] text-ink-soft"
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
                          className="w-[2px] bg-brand rounded-full animate-waveform"
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
                                ? "bg-brand/15 text-brand"
                                : "bg-brand/5 text-ink-soft"
                            }`}
                          >
                            {msg.speaker}
                          </span>
                          <span className="text-[12px] text-ink">
                            {msg.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.typewriterText && (
                    <div className="p-3 rounded-lg bg-white/[0.04] border border-line max-w-[280px] mt-3">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-line">
                        <div className="w-6 h-6 rounded-full bg-brand/20 flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent-primary)">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                          </svg>
                        </div>
                        <span className="text-[12px] font-semibold text-ink">
                          WhatsApp
                        </span>
                      </div>
                      {slide.typewriterText
                        .split("\n")
                        .slice(0, 6)
                        .map((line, j) => (
                          <p
                            key={j}
                            className="text-[12px] text-ink"
                            style={{ fontWeight: line.includes(":") ? 500 : 650 }}
                          >
                            {line}
                          </p>
                        ))}
                    </div>
                  )}

                  {slide.hasMap && (
                    <div className="flex items-center gap-2 mt-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="text-[12px] text-brand">
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

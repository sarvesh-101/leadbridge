"use client";

import { useLandingData } from "@/hooks/useLandingData";

export default function MarqueeTicker() {
  const { data } = useLandingData();
  const stats = data?.stats ?? null;

  // Real product facts — no fabricated "live" events
  const facts = [
    "🤖 AI calls every lead within 60 seconds",
    "🗣️ Speaks Hinglish, Hindi & English",
    "📅 Books site visits automatically",
    "📞 Day 1 + Day 3 follow-up sequence",
    "📲 WhatsApp summary after every call",
    "🎙️ Every call recorded & transcribed",
    "📍 One broker per city — first come, first locked",
    ...(stats && stats.citiesClaimed > 0
      ? [`🏙️ ${stats.citiesClaimed} city${stats.citiesClaimed === 1 ? "" : "s"} claimed so far`]
      : ["🏙️ Every city still open — claim yours first"]),
  ];

  const items = [...facts, ...facts];

  return (
    <div className="relative w-full overflow-hidden border-y border-white/[0.08] bg-[#0D1511]/80 backdrop-blur-sm">
      {/* subtle emerald sheen */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#34D399]/[0.05] to-transparent pointer-events-none" />
      <div className="relative flex overflow-x-hidden h-[80px] items-center">
        <div className="animate-marquee-scroll flex items-center gap-8 whitespace-nowrap hover:[animation-play-state:paused] min-w-max">
          {items.map((event, i) => (
            <span key={i} className="text-[13px] text-[#9FB0A6] font-mono flex-shrink-0">
              {event}
              <span className="mx-6 text-[#34D399]/60">·</span>
            </span>
          ))}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="animate-marquee-scroll flex items-center gap-8 whitespace-nowrap hover:[animation-play-state:paused] min-w-max absolute top-0 left-[100%]">
          {items.map((event, i) => (
            <span key={i} className="text-[13px] text-[#9FB0A6] font-mono flex-shrink-0">
              {event}
              <span className="mx-6 text-[#34D399]/60">·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

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
    <div className="w-full bg-[#14161C] border-y border-[#272B34] overflow-hidden">
      <div className="relative flex overflow-x-hidden h-[80px] items-center">
        <div className="animate-marquee-scroll flex items-center gap-8 whitespace-nowrap hover:[animation-play-state:paused] min-w-max">
          {items.map((event, i) => (
            <span key={i} className="text-[13px] text-[#8B93A3] font-mono flex-shrink-0">
              {event}
              <span className="mx-6 text-[#363B45]">·</span>
            </span>
          ))}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="animate-marquee-scroll flex items-center gap-8 whitespace-nowrap hover:[animation-play-state:paused] min-w-max absolute top-0 left-[100%]">
          {items.map((event, i) => (
            <span key={i} className="text-[13px] text-[#8B93A3] font-mono flex-shrink-0">
              {event}
              <span className="mx-6 text-[#363B45]">·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

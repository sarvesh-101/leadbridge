"use client";

const events = [
  "🟢 Andheri West  ·  Lead called within 41 seconds  ·  Visit booked for tomorrow",
  "🟢 Baner, Pune   ·  Budget ₹1.2Cr confirmed  ·  Site visit: Sat 11 AM",
  "🟡 Thane West    ·  Follow-up D2 sent  ·  Lead re-engaged",
  "🟢 Juhu          ·  3BHK buyer qualified  ·  Ready within 1 month",
  "🟢 Hinjewadi     ·  Cold lead recovered  ·  Rebooked for Sunday",
  "🟡 Powai         ·  Follow-up D1 sent  ·  Lead opened WhatsApp",
  "🟢 Wakad         ·  2BHK buyer qualified  ·  Budget ₹85L confirmed",
  "🔴 Bandra        ·  Lead not interested  ·  Marked cold",
  "🟢 Khar          ·  Lead called within 38 seconds  ·  Visit booked for tomorrow",
  "🟡 Andheri East  ·  Follow-up D3 sent  ·  Lead re-engaged",
];

export default function MarqueeTicker() {
  return (
    <div className="w-full bg-[#111118] border-y border-[#2A2A3A] overflow-hidden">
      <div className="relative flex overflow-x-hidden h-[80px] items-center">
        <div className="animate-marquee-scroll flex items-center gap-8 whitespace-nowrap hover:[animation-play-state:paused] min-w-max">
          {[...events, ...events].map((event, i) => (
            <span key={i} className="text-[13px] text-[#6B6B8A] font-mono flex-shrink-0">
              {event}
              <span className="mx-6 text-[#3A3A52]">·</span>
            </span>
          ))}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="animate-marquee-scroll flex items-center gap-8 whitespace-nowrap hover:[animation-play-state:paused] min-w-max absolute top-0 left-[100%]">
          {[...events, ...events].map((event, i) => (
            <span key={i} className="text-[13px] text-[#6B6B8A] font-mono flex-shrink-0">
              {event}
              <span className="mx-6 text-[#3A3A52]">·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

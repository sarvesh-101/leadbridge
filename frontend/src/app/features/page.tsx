import Link from "next/link";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Features — Converza",
  description: "Every Converza capability, grouped by what it does for your brokerage.",
  alternates: { canonical: `${SITE_URL}/features` },
};

const GROUPS = [
  {
    title: "On every call",
    items: [
      "AI voice agent in Hinglish, Hindi or English",
      "Calls new leads within 60 seconds during calling hours",
      "Qualifies budget, location, property type and timeline",
      "Answers FAQs from the project details you provide",
      "AI lead score (0–100) from source, budget fit, timeline and call sentiment",
      "Mandatory AI disclosure at the start of every call",
    ],
  },
  {
    title: "Booking and follow-up",
    items: [
      "Site-visit booking with 24-hour reminders",
      "No-show recovery follow-ups",
      "Retries after about 2, 4 and 8 hours",
      "Day 1, 2 and 3 sequence (7 days on Pro)",
      "WhatsApp summary after every call",
      "Cold-lead marking so your team stops chasing",
    ],
  },
  {
    title: "Your dashboard",
    items: [
      "Recordings and full transcripts",
      "Bookings calendar",
      "Cost per lead and conversion by source",
      "Weekly results report",
      "Property matching and alerts",
      "Customer portal with OTP login",
      "Payment links and document sharing",
      "Team roles, CSV export, Google Calendar and Sheets sync",
      "Referral tracking",
    ],
  },
  {
    title: "Growth and above",
    items: ["AI voice-agent configuration", "Report builder with scheduled email reports"],
  },
  {
    title: "Pro only",
    items: ["Email campaigns", "SMS campaigns", "A/B tests", "API access", "White-label option"],
  },
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-[#0A0F0C] text-[#F0F7F3] px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-[13px] text-[#9FB0A6] hover:text-[#F0F7F3]">← Back to Converza</Link>
        <h1 className="text-[36px] font-display font-bold mt-6 mb-3">Everything Converza does</h1>
        <p className="text-[15px] text-[#9FB0A6] mb-12 max-w-[640px]">
          Grouped by what it changes in your day. Nothing here is a promise of results — the trial shows
          your own numbers on your own leads.
        </p>

        <div className="space-y-10">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="text-[18px] font-semibold text-[#6FE3B0] mb-4">{group.title}</h2>
              <ul className="grid sm:grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[14px] text-[#C9D6CF]">
                    <span className="text-[#34D399] mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link href="/auth/register" className="rounded-lg border border-white/15 px-6 py-3 text-[14px] text-[#F0F7F3]">
            Start free trial
          </Link>
        </div>
      </div>
    </main>
  );
}

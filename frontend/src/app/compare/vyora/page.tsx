import Link from "next/link";
import type { Metadata } from "next";
import {
  Zap, ArrowLeft, Check, X, PhoneCall, MessageSquare, Globe,
  ShieldCheck, Building2, MapPinned, FileText, Users, Workflow,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Converza vs Vyora AI — Portal-to-call pipeline vs CSV upload",
  description:
    "Vyora calls the leads you upload. Converza calls the leads you haven't seen yet — portal ingestion, WhatsApp bot, CRM, territories and TRAI-aware compliance built in.",
};

/**
 * Factual comparison page. Vyora details sourced from their own public pages
 * (vyora.ai homepage + /pricing, checked Sep 2026): Free 50 credits one-time,
 * Builder ₹799/mo ~113 min (shared number), Business ₹3,449/mo ~533 min
 * (1 dedicated number), 15 credits = 1 minute, 8 Indian languages, CSV/campaign
 * lead upload, CRM integrations, transfer + keypad on Business only.
 * Keep every claim verifiable — no disparagement, features only.
 */

const vyoraHas = (label: string, note?: string) => ({ label, theirs: "check" as const, note });
const vyoraMissing = (label: string, note?: string) => ({ label, theirs: "x" as const, note });

const COMPARISON: {
  area: string;
  icon: React.ReactNode;
  theirs: string;
  ours: string;
}[] = [
  {
    area: "How leads reach the AI",
    icon: <PhoneCall className="w-4 h-4" />,
    theirs:
      "You download/export leads and upload a CSV, or add them via campaign builder. The AI calls what you give it.",
    ours: "Portal leads (SMS-forward, email-forward, Facebook Lead Ads, IndiaMART push) land in Converza and the AI calls them within 60 seconds — no human touches anything.",
  },
  {
    area: "Speed-to-lead in practice",
    icon: <Workflow className="w-4 h-4" />,
    theirs:
      "Fast once the lead is uploaded — but a lead sitting in yesterday's export was never called in 60 seconds.",
    ours: "The 60-second promise covers the whole journey: portal message → parsed → lead created → call dispatched. Nights and weekends included.",
  },
  {
    area: "WhatsApp",
    icon: <MessageSquare className="w-4 h-4" />,
    theirs: "Not part of the product.",
    ours: "AI WhatsApp bot for inbound chats, template follow-ups, visit bookings and lead alerts — where Indian buyers actually reply.",
  },
  {
    area: "CRM around the calls",
    icon: <Building2 className="w-4 h-4" />,
    theirs: "Call recordings, transcripts and outcomes; CRM integrations.",
    ours: "Full built-in CRM: properties with photos, lead pipeline, documents, bookings, teams, Sheets sync — the call is one step of the workflow, not the whole product.",
  },
  {
    area: "Territory exclusivity",
    icon: <MapPinned className="w-4 h-4" />,
    theirs: "Not offered.",
    ours: "Own your micro-market. One broker per territory — your competitors can't sign up for your area.",
  },
  {
    area: "Caller number on entry plan",
    icon: <PhoneCall className="w-4 h-4" />,
    theirs: "Shared number on Builder (₹799). Dedicated number costs extra (₹749/mo) or starts at Business.",
    ours: "Your AI agent runs on your telephony setup — prospects see a consistent number tied to your business.",
  },
  {
    area: "Languages",
    icon: <Globe className="w-4 h-4" />,
    theirs: "8 Indian languages.",
    ours: "14+ Indian languages (Hinglish, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi and more) plus international languages — powered by Omnidimension's 100+ language platform.",
  },
  {
    area: "Human handoff",
    icon: <Users className="w-4 h-4" />,
    theirs: "Call transfer on Business plan.",
    ours: "Live call transfer to your phone on every plan — the AI hands over hot leads and anyone who asks for a human.",
  },
  {
    area: "Compliance posture",
    icon: <ShieldCheck className="w-4 h-4" />,
    theirs: "160-series routing + DND scrubbing built in.",
    ours: "Per-campaign-type TRAI gate: enquiry responses treated as service calls, promotional campaigns window-checked (9–9 IST) with consent-basis logging, mandatory AI disclosure in every agent script, GST-registered entity (GS TECHNO) and DPDP erasure built in.",
  },
  {
    area: "GST invoicing",
    icon: <FileText className="w-4 h-4" />,
    theirs: "GST invoices offered.",
    ours: "GST invoices with our registered GSTIN (27AEGPH7840P1ZX) — input-credit ready from day one.",
  },
];

type Cell = { label: string; theirs: "check" | "x"; note?: string };

const FEATURE_ROWS: { feature: string; vyora: Cell; converza: Cell }[] = [
  { feature: "AI outbound calling (Hinglish + regional)", vyora: vyoraHas("Yes"), converza: { label: "Yes", theirs: "check" } },
  { feature: "Portal lead ingestion (SMS/email/FB/IndiaMART)", vyora: vyoraMissing("CSV upload"), converza: { label: "Automatic", theirs: "check" } },
  { feature: "Calls lead within 60s of enquiry", vyora: vyoraMissing("After upload"), converza: { label: "Yes, end-to-end", theirs: "check" } },
  { feature: "WhatsApp AI bot + follow-ups", vyora: vyoraMissing("—"), converza: { label: "Included", theirs: "check" } },
  { feature: "Built-in property CRM", vyora: vyoraMissing("Integrations only"), converza: { label: "Built in", theirs: "check" } },
  { feature: "Territory exclusivity", vyora: vyoraMissing("—"), converza: { label: "Yes", theirs: "check" } },
  { feature: "Call transfer to human", vyora: vyoraHas("Business plan"), converza: { label: "Every plan", theirs: "check" } },
  { feature: "AI disclosure + consent-basis logging", vyora: vyoraHas("160-series + DND"), converza: { label: "Per-campaign TRAI gate", theirs: "check" } },
  { feature: "Credits never expire", vyora: vyoraHas("Yes"), converza: { label: "Monthly plan with call caps", theirs: "check" } },
];

export default function CompareVyoraPage() {
  return (
    <div className="min-h-screen bg-[#0A0F0C]">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-[#9FB0A6] hover:text-[#F0F7F3] mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.4)]">
              <Zap className="w-5 h-5 text-[#0A0F0C]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-[#F0F7F3]">Converza vs Vyora AI</h1>
              <p className="text-[#9FB0A6] text-sm mt-1">
                The honest comparison — their features as published on vyora.ai, September 2026.
              </p>
            </div>
          </div>
          <div className="p-5 rounded-xl bg-[#34D399]/10 border border-[#34D399]/25">
            <p className="text-[#F0F7F3] text-sm md:text-base leading-relaxed">
              <span className="font-semibold">Vyora calls the leads you upload.</span>{" "}
              <span className="text-[#6FE3B0] font-semibold">Converza calls the leads you haven&apos;t seen yet.</span>{" "}
              If your workflow already includes exporting leads to a spreadsheet, both tools work.
              If you want the phone to ring before you&apos;ve opened your laptop, that&apos;s the difference.
            </p>
          </div>
        </div>

        {/* Feature matrix */}
        <div className="mb-14 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left">
                <th className="py-3 pr-4 text-[#9FB0A6] font-medium text-xs uppercase tracking-wide">Feature</th>
                <th className="py-3 px-4 text-[#9FB0A6] font-medium text-xs uppercase tracking-wide">Vyora</th>
                <th className="py-3 pl-4 text-[#6FE3B0] font-medium text-xs uppercase tracking-wide">Converza</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.feature} className="border-t border-white/[0.06]">
                  <td className="py-3 pr-4 text-[#F0F7F3]">{row.feature}</td>
                  <td className="py-3 px-4 text-[#9FB0A6]">
                    <span className="inline-flex items-center gap-1.5">
                      {row.vyora.theirs === "check"
                        ? <Check className="w-3.5 h-3.5 text-[#9FB0A6]" />
                        : <X className="w-3.5 h-3.5 text-gray-600" />}
                      {row.vyora.label}
                    </span>
                  </td>
                  <td className="py-3 pl-4 text-[#F0F7F3]">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#34D399]" />
                      {row.converza.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Deep dives */}
        <div className="space-y-8 mb-14">
          {COMPARISON.map((c) => (
            <div key={c.area} className="grid md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#9FB0A6]">{c.icon}</span>
                  <h3 className="text-sm font-semibold text-[#F0F7F3]">{c.area}</h3>
                </div>
                <p className="text-[13px] text-[#9FB0A6] leading-relaxed">
                  <span className="font-medium text-[#C9D6CF]">Vyora: </span>{c.theirs}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-[#34D399]/[0.07] border border-[#34D399]/25">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#6FE3B0]">{c.icon}</span>
                  <h3 className="text-sm font-semibold text-[#F0F7F3]">{c.area}</h3>
                </div>
                <p className="text-[13px] text-[#C9D6CF] leading-relaxed">
                  <span className="font-medium text-[#6FE3B0]">Converza: </span>{c.ours}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Fair-pricing note */}
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.08] mb-14">
          <h3 className="text-sm font-semibold text-[#F0F7F3] mb-2">A fair word on pricing</h3>
          <p className="text-[13px] text-[#9FB0A6] leading-relaxed">
            Vyora&apos;s credit plans (₹799/mo, credits that never expire) are genuinely good value for
            uploading-and-calling a list. We won&apos;t pretend otherwise. Converza costs more because it
            does more: portal pipelines that replace the CSV step entirely, WhatsApp automation, a real
            CRM, and territory ownership. If you only need &ldquo;call this spreadsheet,&rdquo; a credits tool
            is fine. If you want the whole lead-to-booking loop to run itself, that&apos;s what we built.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-[#34D399]/15 to-transparent border border-[#34D399]/25">
          <h2 className="text-xl md:text-2xl font-bold text-[#F0F7F3] mb-2">
            See your portal lead get called in 60 seconds
          </h2>
          <p className="text-[#9FB0A6] text-sm mb-6">
            Free test call · No credit card · Your territory, your number
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            Start free <ArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-10">
          Vyora features and pricing referenced from their public website (vyora.ai, September 2026) and remain
          the property of Vyora AI. Comparison is factual and feature-based; verify current details independently.
          Converza is operated by GS TECHNO · GSTIN 27AEGPH7840P1ZX.
        </p>
      </div>
    </div>
  );
}

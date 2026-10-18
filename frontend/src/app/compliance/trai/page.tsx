import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck, Clock, Hash, FileCheck2, PhoneCall, Flame,
  AlertTriangle, ArrowLeft, CheckCircle2, Ban, Gavel,
} from "lucide-react";

export const metadata: Metadata = {
  title: "TRAI Calling Rules for Real Estate Brokers — 2026 Guide | Converza",
  description:
    "Plain-English guide to TRAI telemarketing rules for Indian real estate brokers: transactional vs promotional calls, the 9 AM–9 PM window, 140-series numbers, DLT registration, DND handling and AI-voice disclosure — and exactly how Converza keeps you on the right side of each one.",
};

/**
 * TRAI compliance guide. Sources:
 * - TRAI TCCCPR 2018 (Telecom Commercial Communications Customer Preference
 *   Regulations) and 2025 amendment notifications (trai.gov.in)
 * - 140-series mandate for promotional voice calls (TRAI, Feb 2025
 *   clarification; promotional calls ONLY via 140-series numbers)
 * - 1600/1601 series for transactional/service calls
 * - 9 AM–9 PM IST permitted window for commercial/promotional calls
 * - DLT (Distributed Ledger Technology) registration for headers + templates
 * Facts kept conservative; not legal advice disclaimer included.
 * Converza platform behaviour mirrors server-side call-compliance.ts
 * (consent-basis engine + 9–9 window enforcement + AI disclosure).
 */

const RULES: {
  icon: React.ReactNode;
  title: string;
  rule: string;
  whatConverzaDoes: string;
}[] = [
  {
    icon: <PhoneCall className="w-5 h-5" />,
    title: "Calling a lead who enquired on 99acres / MagicBricks / IndiaMART",
    rule: "That's a follow-up to an inbound enquiry — the customer reached out first and expects a response. This is treated as transactional in substance: no DLT/140-series registration is required on your side, and you're not spam.",
    whatConverzaDoes:
      "Converza treats every portal-ingested lead as consent-based by default. The AI calls within 60 seconds, any time of day the enquiry arrives — but the call itself is always placed inside the permitted 9 AM–9 PM IST window.",
  },
  {
    icon: <Flame className="w-5 h-5" />,
    title: "Promotional / cold campaigns (calling people who never enquired)",
    rule: "Strictly regulated: promotional calls must originate ONLY from 140-series numbers, require DLT (Distributed Ledger Technology) registration of your entity + header + message templates, and never go to numbers registered on DND/NCPR. Violations can mean blacklisting of your number and entity, with heavy penalties.",
    whatConverzaDoes:
      "Converza's consent-basis engine blocks promotional campaign dispatch entirely unless the target audience has recorded opt-in. Portal enquiry leads and existing clients are always callable; cold audiences are not — the platform refuses, by design.",
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: "Permitted calling hours",
    rule: "Commercial and promotional calls (and SMS) are restricted to 9 AM – 9 PM IST. Calls outside this window are a violation regardless of the content or consent.",
    whatConverzaDoes:
      "Enforced in code: every outbound call is checked against the IST window before dispatch and scheduled to the next permitted slot instead. No 'oops, the AI called at 11 PM' — it cannot happen.",
  },
  {
    icon: <Hash className="w-5 h-5" />,
    title: "Number series and what your caller ID says about you",
    rule: "TRAI operates dedicated series so customers can identify calls: 140-series for promotional, 1600/1601 for transactional/service, regular 10-digit mobile numbers remain valid for two-way personal/business communication — but 10-digit numbers cannot be used for bulk promotional telemarketing.",
    whatConverzaDoes:
      "Standard transactional calls to your inbound leads run on normal purchased +91 numbers. As your business scales into promotional campaigns, the 140-series/DLT path is the documented upgrade — our team handles the mapping when that day comes.",
  },
  {
    icon: <Ban className="w-5 h-5" />,
    title: "DND / NCPR-registered customers",
    rule: "Promotional calls to numbers on the National Customer Preference Register (DND list) are prohibited. Transactional follow-ups on an existing relationship or enquiry are not 'promotional'.",
    whatConverzaDoes:
      "Lead source and consent basis are stamped on every call in an audit trail. Enquiry follow-ups proceed; anything promotional is gated on verified opt-in before a single call is queued.",
  },
  {
    icon: <Gavel className="w-5 h-5" />,
    title: "AI voice agents — disclosure",
    rule: "Regulators and consumer-protection norms increasingly expect callers to identify themselves and be transparent when an automated system is speaking. Fake or misleading caller intent (pretending to be a person, a bank, or a government agency) is punishable.",
    whatConverzaDoes:
      "Every Converza agent's script opens with a mandatory, unskippable AI disclosure — the prospect is told they're speaking to an automated real-estate assistant and can be transferred to the actual broker anytime.",
  },
];

const CHECKLIST = [
  "You only call leads who enquired with you first (portal walk-ins, references, your ads) — no bought lists.",
  "All calling happens 9 AM – 9 PM IST.",
  "No bulk 'promotion' blasts to prospecting audiences without written opt-in + DLT setup.",
  "The AI identifies itself as an automated assistant at the start of every call.",
  "You keep records of enquiry source and consent — Converza stores this automatically per lead.",
];

export default function TraiCompliancePage() {
  return (
    <div className="min-h-screen bg-[#0A0F0C] text-[#F0F7F3]">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-[#9FB0A6] hover:text-[#F0F7F3]">
            <ArrowLeft className="h-4 w-4" /> Converza
          </Link>
          <Link
            href="/auth/register"
            className="rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] px-4 py-2 text-sm font-semibold text-[#0A0F0C] hover:opacity-90"
          >
            Start free trial
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 text-[#6FE3B0]">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            TRAI Compliance · Indian Real Estate Calling
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
          The rulebook, in plain English
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#9FB0A6]">
          Most AI-calling platforms copy-paste a generic disclaimer and leave you to figure out
          TRAI on your own. This page is the guide we wish existed: what the
          <span className="text-[#F0F7F3]"> Telecom Commercial Communications Customer
          Preference Regulations (TCCCPR) </span>
          actually mean for a real-estate broker who calls leads by phone — and exactly
          what Converza enforces in code so you don&apos;t have to memorise any of it.
        </p>

        {/* The core distinction */}
        <section className="mt-10 rounded-xl border border-[#34D399]/25 bg-[#101713] p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <FileCheck2 className="h-5 w-5 text-[#6FE3B0]" />
            One distinction explains almost everything
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-[#0A0F0C] p-4">
              <p className="text-sm font-semibold text-[#6FE3B0]">Follow-up to an enquiry</p>
              <p className="mt-2 text-sm leading-relaxed text-[#9FB0A6]">
                Someone enquired on 99acres, walked into your site, called your number, or
                WhatsApp&apos;d you. Calling them back — including via AI — is a service
                response. Light-touch rules; portal enquiry leads are the bread and butter
                of every broker and are fine to call.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0A0F0C] p-4">
              <p className="text-sm font-semibold text-[#34D399]">Promotional outreach</p>
              <p className="mt-2 text-sm leading-relaxed text-[#9FB0A6]">
                Calling or messaging people who never asked to hear from you —
                purchased lists, &quot;area blast&quot; campaigns. Requires 140-series numbers,
                DLT registration, opt-in respect and DND scrubbing.
              </p>
            </div>
          </div>
        </section>

        {/* Rules table */}
        <section className="mt-10 space-y-4">
          {RULES.map((r) => (
            <div
              key={r.title}
              className="rounded-xl border border-white/10 bg-[#101713] p-6"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-[#1B4332] p-2 text-[#6FE3B0]">
                  {r.icon}
                </div>
                <div>
                  <h3 className="font-semibold">{r.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#9FB0A6]">{r.rule}</p>
                  <p className="mt-3 rounded-lg border-l-2 border-[#34D399] bg-[#0D1A12] px-4 py-2.5 text-sm leading-relaxed text-[#D9EFE4]">
                    <span className="font-semibold text-[#6FE3B0]">Converza behaviour: </span>
                    {r.whatConverzaDoes}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Self-check */}
        <section className="mt-10 rounded-xl border border-white/10 bg-[#101713] p-6">
          <h2 className="text-xl font-semibold">Your 5-point broker self-check</h2>
          <ul className="mt-4 space-y-3">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[#9FB0A6]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6FE3B0]" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Disclaimer */}
        <div className="mt-10 flex items-start gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-relaxed text-amber-200/80">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This guide summarises publicly available TRAI guidance (TCCCPR 2018 and
            subsequent amendments, February 2025 number-series clarification) as of
            October 2026 for general information. It is not legal advice. Rules evolve —
            verify current requirements at trai.gov.in or with your compliance advisor
            before running large-volume or promotional campaigns.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-xl bg-gradient-to-r from-[#1B4332] to-[#0A0F0C] p-8 text-center">
          <h2 className="text-2xl font-bold">Compliance built in, not bolted on</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[#9FB0A6]">
            Every Converza call passes through consent checks, the permitted-hours window
            and an audit trail — automatically, on every single call.
          </p>
          <Link
            href="/auth/register"
            className="mt-5 inline-block rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] px-6 py-3 text-sm font-semibold text-[#0A0F0C] hover:opacity-90"
          >
            Start your 30-day free trial
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-[#5B6B61]">
        © 2024-2026 Converza (GS TECHNO · Maharashtra) · AI-powered lead conversion for Indian real-estate brokers
      </footer>
    </div>
  );
}

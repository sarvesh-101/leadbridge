"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X, PhoneCall, MessageSquare, Globe, ShieldCheck, Building2, MapPinned, FileText, Users, Workflow } from "lucide-react";
import { COMPARE_PAGE_ENABLED } from "@/lib/site";

/**
 * V2 (T10) — competitor comparison page.
 *
 * Hidden behind NEXT_PUBLIC_COMPARE_PAGE_ENABLED=false until a human verifies
 * every claim and confirms the "last verified" date. Nothing here may disparage
 * a competitor; only published, checkable facts.
 */
const LAST_VERIFIED = "September 2026";

const ROWS = [
  { area: "How leads reach the AI", icon: <PhoneCall className="w-4 h-4" />, theirs: "You export leads and upload a CSV, or add them in a campaign builder.", ours: "Portal and form leads land in Converza and the AI calls them during calling hours — no export step." },
  { area: "Speed to lead", icon: <Workflow className="w-4 h-4" />, theirs: "Fast once a lead is uploaded.", ours: "The 60-second target covers the whole journey: enquiry → parsed → lead created → call queued, during 9 AM–9 PM IST." },
  { area: "WhatsApp", icon: <MessageSquare className="w-4 h-4" />, theirs: "Not part of the published product.", ours: "WhatsApp summaries after each call and template follow-ups." },
  { area: "CRM around the calls", icon: <Building2 className="w-4 h-4" />, theirs: "Recordings, transcripts and CRM integrations.", ours: "Properties, lead pipeline, documents, bookings, team roles and Sheets sync in the same product." },
  { area: "Territory exclusivity", icon: <MapPinned className="w-4 h-4" />, theirs: "Not offered.", ours: "One Converza broker per zone while the territory is active. Other tools are never blocked." },
  { area: "Languages", icon: <Globe className="w-4 h-4" />, theirs: "8 Indian languages per their public site.", ours: "Hinglish, Hindi and English by default; more Indian languages available through the voice provider." },
  { area: "Compliance posture", icon: <ShieldCheck className="w-4 h-4" />, theirs: "160-series routing and DND scrubbing per their public site.", ours: "AI disclosure at the start of every call, 9 AM–9 PM IST calling window, consent-basis logging, DND-aware dialling." },
  { area: "GST invoicing", icon: <FileText className="w-4 h-4" />, theirs: "GST invoices offered.", ours: "GST invoices from GS TECHNO (GSTIN 27AEGPH7840P1ZX)." },
  { area: "Human handoff", icon: <Users className="w-4 h-4" />, theirs: "Call transfer on their Business plan.", ours: "Call transfer to your phone on every plan." },
];

export default function CompareVyoraPage() {
  if (!COMPARE_PAGE_ENABLED) notFound();

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center gap-2 text-ink-soft hover:text-ink mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-ink">Converza vs Vyora AI</h1>
          <p className="text-ink-soft text-sm mt-2">
            Feature comparison based on their public website, last verified {LAST_VERIFIED}.
          </p>
        </div>

        <div className="space-y-6 mb-14">
          {ROWS.map((c) => (
            <div key={c.area} className="grid md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-surface border border-line">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-ink-soft">{c.icon}</span>
                  <h3 className="text-sm font-semibold text-ink">{c.area}</h3>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  <span className="font-medium text-ink-soft">Vyora: </span>{c.theirs}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-brand/[0.07] border border-brand/25">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-brand">{c.icon}</span>
                  <h3 className="text-sm font-semibold text-ink">{c.area}</h3>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  <span className="font-medium text-brand">Converza: </span>{c.ours}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 rounded-xl bg-surface border border-line mb-14">
          <h3 className="text-sm font-semibold text-ink mb-2">A fair word on pricing</h3>
          <p className="text-[13px] text-ink-soft leading-relaxed">
            Vyora&apos;s credit plans may suit a workflow that is mainly uploading a list and calling it.
            Converza is built around portal ingestion, WhatsApp follow-ups and the CRM around the call, which is why the product scope is broader.
            If your need is only &ldquo;call this spreadsheet&rdquo;, a credits tool may be the better fit.
          </p>
        </div>

        <p className="text-center text-[11px] text-ink-muted mt-10">
          Vyora features and pricing referenced from their public website ({LAST_VERIFIED}) and belong to Vyora AI.
          Converza is operated by GS TECHNO · GSTIN 27AEGPH7840P1ZX.
        </p>
      </div>
    </div>
  );
}

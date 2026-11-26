"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Mail, CheckCircle2, XCircle, Loader2, Copy,
  ChevronDown, ChevronUp, Smartphone, Inbox, ArrowRight, Send,
  Phone, ExternalLink, AlertCircle, RefreshCw, History, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

interface ForwardingStatus {
  smsConfigured: boolean;
  emailConfigured: boolean;
  forwardingNumber: string;
  forwardingEmail: string;
  recentLeads: Array<{
    id: string;
    name: string;
    phone: string;
    source: string;
    status: string;
    createdAt: string;
  }>;
}

const PORTAL_SMS_EXAMPLES = [
  {
    portal: "99acres",
    template: "Enquiry from 99acres. Name: Rahul Sharma. Phone: 9876543210. Budget: 80 Lakhs. Location: Andheri West Mumbai. Property: 2 BHK",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    portal: "MagicBricks",
    template: "MB: New enquiry for your property. Contact: Priya Patel. Mobile: 9988776655. Requirement: 2BHK in Bandra West. Budget: 1.2 Cr",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    portal: "JustDial",
    template: "JustDial Enquiry - Amit Singh, +91-9876543210, Interested in 2BHK rental in Andheri West. Budget: 50K/month",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    portal: "Manual",
    template: "Rahul 9876543210 2BHK Andheri 80L near station",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
    CALLING: "text-blue-400 border-blue-500/20 bg-blue-500/10",
    BOOKED: "text-success border-success/20 bg-success/10",
    CONVERTED: "text-success border-success/20 bg-success/10",
    COLD: "text-ink-soft border-line/20 bg-neutral-soft/10",
  };
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", colors[status] || "text-ink-soft border-line/20 bg-neutral-soft/10")}>
      {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4 text-ink-soft" />}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="p-5 rounded-2xl app-card animate-pulse space-y-3">
      <div className="h-5 w-40 bg-white/[0.06] rounded" />
      <div className="h-3 w-64 bg-canvas rounded" />
      <div className="flex gap-2">
        <div className="h-8 w-32 bg-white/[0.06] rounded-lg" />
        <div className="h-8 w-32 bg-white/[0.06] rounded-lg" />
      </div>
    </div>
  );
}

// ─── Portal Auto-Forward Wizard — zero-touch lead setup ─────────────────────
// The pitch: ONE-TIME setup per portal → every future enquiry is AI-called
// automatically. No per-lead forwarding, no CSV uploads (the Vyora way).

interface AutoForwardPortal {
  id: string;
  name: string;
  emoji: string;
  hasDirectApi: boolean;
  /** Word the auto-forward app matches in the SMS body */
  matchWord: string;
  /** Domain(s) for the Gmail auto-forward filter */
  emailDomains: string;
}

const AUTO_FORWARD_PORTALS: AutoForwardPortal[] = [
  { id: "indiamart", name: "IndiaMART", emoji: "🟢", hasDirectApi: true, matchWord: "IndiaMART", emailDomains: "indiamart.com" },
  { id: "justdial", name: "JustDial", emoji: "📞", hasDirectApi: false, matchWord: "JustDial", emailDomains: "justdial.com" },
  { id: "99acres", name: "99acres", emoji: "🏠", hasDirectApi: false, matchWord: "99acres", emailDomains: "99acres.com" },
  { id: "magicbricks", name: "MagicBricks", emoji: "🪄", hasDirectApi: false, matchWord: "Magic", emailDomains: "magicbricks.com" },
  { id: "housing", name: "Housing.com", emoji: "🏡", hasDirectApi: false, matchWord: "Housing", emailDomains: "housing.com" },
  { id: "other", name: "Any other portal", emoji: "✳️", hasDirectApi: false, matchWord: "the portal's name (Sulekha, NoBroker, TradeIndia…)", emailDomains: "the portal's domain (sulekha.com, nobroker.in…)" },
];

type ChannelTab = "api" | "sms" | "email";

function PortalWizard({ forwardingEmail, forwardingNumber }: { forwardingEmail: string; forwardingNumber: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<ChannelTab>("sms");
  const [donePortals, setDonePortals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try { setDonePortals(JSON.parse(localStorage.getItem("converza-portal-setup") || "{}")); } catch { /* corrupt flag — start fresh */ }
  }, []);

  const markDone = (id: string) => {
    const next = { ...donePortals, [id]: !donePortals[id] };
    setDonePortals(next);
    try { localStorage.setItem("converza-portal-setup", JSON.stringify(next)); } catch { /* private mode */ }
    if (next[id]) toast.success(`${AUTO_FORWARD_PORTALS.find(p => p.id === id)?.name} marked as live 🎉`);
  };

  const openPortal = (id: string) => {
    setSelected(selected === id ? null : id);
    const p = AUTO_FORWARD_PORTALS.find(x => x.id === id);
    setTab(p?.hasDirectApi ? "api" : "sms");
  };

  const portal = AUTO_FORWARD_PORTALS.find(p => p.id === selected) || null;
  const domainsOr = portal ? portal.emailDomains.split(" ").slice(0, 1).join("") : "";
  const playStoreSearch = "https://play.google.com/store/search?q=sms%20forwarder%20auto%20forward&c=apps";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      className="p-5 rounded-2xl app-card"
    >
      <div className="flex items-start justify-between mb-1 gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand" />
            Zero-Touch Setup — connect each portal ONCE
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Do this once per portal. After that <strong className="text-brand">every enquiry is AI-called automatically</strong> — you never forward a lead or upload a CSV again.
          </p>
        </div>
      </div>

      {/* Portals grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
        {AUTO_FORWARD_PORTALS.map(p => (
          <button key={p.id} onClick={() => openPortal(p.id)}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              selected === p.id ? "border-brand/50 bg-brand/5" : "border-line bg-black/20 hover:border-brand/30"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg">{p.emoji}</span>
              {donePortals[p.id] && (
                <span className="flex items-center gap-1 text-[10px] text-success font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Live
                </span>
              )}
            </div>
            <p className="text-[12px] font-medium text-ink mt-1">{p.name}</p>
            <p className="text-[10px] text-ink-soft">
              {p.hasDirectApi ? "Official API · best" : "Auto-forward"}
            </p>
          </button>
        ))}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {portal && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-black/30 border border-line">
              <div className="flex items-center gap-2 mb-4">
                <span>{portal.emoji}</span>
                <span className="text-sm font-semibold text-ink">{portal.name}</span>
                <span className="text-[10px] text-success px-2 py-0.5 rounded-full bg-success/10 border border-success/20 ml-auto">
                  one-time · ~{portal.hasDirectApi ? "10" : "15"} min
                </span>
              </div>

              {/* Channel tabs */}
              <div className="flex gap-1.5 mb-4">
                {[
                  ...(portal.hasDirectApi ? [{ id: "api" as ChannelTab, label: "Direct API ★ best" }] : []),
                  { id: "sms" as ChannelTab, label: "Auto-forward SMS" },
                  { id: "email" as ChannelTab, label: "Auto-forward Email" },
                ].map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] border transition-colors",
                      tab === t.id
                        ? "bg-brand/15 border-brand/50 text-brand font-medium"
                        : "bg-white/[0.06] border-line text-ink-soft hover:border-brand/30"
                    )}
                  >{t.label}</button>
                ))}
              </div>

              {/* ── Direct API tab (IndiaMART) ── */}
              {tab === "api" && (
                <ol className="space-y-3 text-xs text-ink-soft">
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">1.</span>
                    <span>Open <a href="https://seller.indiamart.com/leadmanager/crmapi" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">seller.indiamart.com/leadmanager/crmapi <ExternalLink className="w-3 h-3" /></a> → tap <strong className="text-ink">⋮ → CRM Integration → Generate Key</strong>. The key is emailed to your registered email.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">2.</span>
                    <span>In Converza, open <Link href="/dashboard/integrations" className="text-brand hover:underline">Integrations → IndiaMART → Connect</Link> → enter your 10-digit IndiaMART mobile + paste the key → <strong className="text-ink">Save &amp; Verify</strong>.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">3.</span>
                    <span>For real-time push: IndiaMART → <strong className="text-ink">Lead Manager → Import/Export Leads → Push API</strong> → choose platform <strong className="text-ink">"Other"</strong> → name it Converza → paste the webhook URL shown on our Integrations page → confirm the OTP on your phone.</span>
                  </li>
                  <li className="p-2.5 rounded-lg bg-success/5 border border-success/15"><span className="text-[11px] text-brand">✅ Done forever — every future IndiaMART enquiry reaches Converza in real time and gets AI-called. You never touch it again.</span></li>
                  <li className="p-2.5 rounded-lg bg-warning/5 border border-warning/10"><span className="text-[11px] text-warning">⚠️ IndiaMART's Leads API is a paid IndiaMART add-on. If "Generate Key" doesn't work, ask your IndiaMART account manager — or use the Auto-forward SMS/Email tabs below (same result, ₹0).</span></li>
                </ol>
              )}

              {/* ── Auto-forward SMS tab ── */}
              {tab === "sms" && (
                <ol className="space-y-3 text-xs text-ink-soft">
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">1.</span>
                    <span>On your Android phone, install a free auto-forward app — <a href={playStoreSearch} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">Play Store: "SMS Forwarder" <ExternalLink className="w-3 h-3" /></a> (any app with "auto forward + filter" works; iPhone users: use the Email tab or the manual forward steps below).</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">2.</span>
                    <span>Create a forwarding rule. <strong className="text-ink">Forward TO this number:</strong>
                      <span className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-line">
                        <strong className="text-[11px] text-ink font-mono break-all">{forwardingNumber}</strong>
                        <span className="ml-auto"><CopyBtn text={forwardingNumber} /></span>
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">3.</span>
                    <span>Set the match filter to <strong className="text-ink">"text contains"</strong> →<br /><strong className="text-[11px] text-ink font-mono">{portal.matchWord}</strong> — every SMS from {portal.name} matches, whatever sender ID they use.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">4.</span>
                    <span>Allow the app to run in background (accept the battery-optimisation prompt). Test with the <strong className="text-ink">Test Forward</strong> section below, then tap <strong className="text-ink">Mark as live</strong>. ✅ Every future {portal.name} SMS self-forwards — zero work per lead.</span>
                  </li>
                </ol>
              )}

              {/* ── Auto-forward Email tab ── */}
              {tab === "email" && (
                <ol className="space-y-3 text-xs text-ink-soft">
                  <li className="p-2.5 rounded-lg bg-warning/5 border border-warning/10"><span className="text-[11px] text-warning">⚠️ Do this from the <strong>same Gmail account you signed up with</strong> — Converza matches forwarded emails to your account by sender. Forwards from other addresses are ignored.</span></li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">1.</span>
                    <span>Gmail on a computer → <strong className="text-ink">⚙ → See all settings → Forwarding and POP/IMAP</strong> → <strong className="text-ink">Add a forwarding address</strong> → paste:
                      <span className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-line">
                        <strong className="text-[11px] text-ink font-mono break-all">{forwardingEmail}</strong>
                        <span className="ml-auto"><CopyBtn text={forwardingEmail} /></span>
                      </span>
                      Gmail sends a confirmation to that mailbox — we help you confirm it during onboarding.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">2.</span>
                    <span>In the Gmail search bar, click the <strong className="text-ink">filter sliders icon</strong> → in <strong className="text-ink">From</strong> enter: <strong className="text-[11px] text-ink font-mono">{domainsOr}</strong> → <strong className="text-ink">Create filter</strong>.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">3.</span>
                    <span>Tick <strong className="text-ink">"Forward it to: {forwardingEmail}"</strong> → <strong className="text-ink">Create filter</strong>. ✅ Every future {portal.name} enquiry email auto-forwards and gets AI-called — you never open it.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-brand shrink-0 font-bold">4.</span>
                    <span>Test with a real enquiry email → check <strong className="text-ink">Leads</strong> within ~5 minutes → <strong className="text-ink">Mark as live</strong>.</span>
                  </li>
                </ol>
              )}

              {/* Mark as live */}
              <button onClick={() => markDone(portal.id)}
                className={cn(
                  "mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors",
                  donePortals[portal.id]
                    ? "bg-success/15 border border-success/30 text-success"
                    : "bg-brand text-canvas hover:opacity-90"
                )}
              >
                {donePortals[portal.id] ? <><CheckCircle2 className="w-4 h-4" /> {portal.name} is LIVE — tap to undo</> : <><Zap className="w-4 h-4" /> Mark {portal.name} as live</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard unavailable */ }
      }}
      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-ink-soft transition-colors shrink-0"
      title="Copy"
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function LeadForwardingPage() {
  const [status, setStatus] = useState<ForwardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>("sms");
  const [sendingTest, setSendingTest] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  // This broker's own `leads+<token>@<domain>` address — the one an auto-forward
  // rule should point at (the shared mailbox only works for manual forwards).
  const [brokerEmail, setBrokerEmail] = useState("");

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const [smsStatus, emailStatus, addressStatus, recentLeads] = await Promise.all([
        api.get<{ configured: boolean; forwardingNumber: string }>("/webhooks/sms/status").catch(() => null),
        api.get<{ configured: boolean; forwardingEmail: string }>("/webhooks/email/status").catch(() => null),
        api.get<{ address: string }>("/forwarding/address").catch(() => null),
        api.get<{ leads: ForwardingStatus["recentLeads"] }>("/leads?source=sms_forward,email_forward,email_forward_99acres,email_forward_magicbricks,email_forward_justdial&limit=10&sort=-createdAt").catch(() => null),
      ]);

      setStatus({
        smsConfigured: smsStatus?.configured || false,
        emailConfigured: emailStatus?.configured || false,
        forwardingNumber: smsStatus?.forwardingNumber || process.env.NEXT_PUBLIC_FORWARDING_SMS_NUMBER || "+919876543210",
        forwardingEmail: emailStatus?.forwardingEmail || process.env.NEXT_PUBLIC_FORWARDING_EMAIL || "forward@converza.tech",
        recentLeads: (recentLeads as any)?.leads?.slice(0, 5) || [],
      });
      setBrokerEmail(addressStatus?.address || "");
    } catch (err: any) {
      toast.error("Failed to load forwarding status");
    } finally {
      setLoading(false);
    }
  }

  async function testForwarding() {
    if (!testPhone || testPhone.length < 10) return toast.error("Enter a valid phone number");
    setSendingTest(true);
    try {
      // Use the authenticated test endpoint (JWT-protected, uses the user's own broker ID)
      const testBody = "New test lead: Test User Phone: " + testPhone + " Budget: 80L Location: Test Area";
      const res = await api.post<{ status: string; leadId: string; parsed: any }>("/forwarding/test", {
        phone: testPhone,
        body: testBody,
      });

      if (res.status === "created") {
        toast.success(`Test lead created! ID: ${res.leadId.slice(0, 8)}...`);
        await loadStatus();
      } else if (res.status === "duplicate") {
        toast.info("A lead with this phone already exists in the last 30 days");
      }
    } catch (err: any) {
      toast.error(err.message || "Test failed");
    } finally {
      setSendingTest(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSection(expandedSection === section ? null : section);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="sticky top-0 z-10 bg-canvas/80 backdrop-blur-lg border-b border-line">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-white/[0.06] rounded" />
              <div className="h-3 w-48 bg-canvas rounded" />
            </div>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-canvas/80 backdrop-blur-lg border-b border-line">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-line-subtle to-brand flex items-center justify-center">
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">Lead Forwarding</h1>
            <p className="text-xs text-ink-soft">Forward portal SMS/emails to auto-create leads with AI calling</p>
          </div>
          <button onClick={loadStatus} className="ml-auto p-2 rounded-lg hover:bg-white/[0.06] text-ink-soft transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-5 rounded-2xl border transition-all",
              status?.smsConfigured
                ? "bg-success/5 border-success/20"
                : "bg-canvas border-line"
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                status?.smsConfigured ? "bg-success/20" : "bg-white/[0.06]"
              )}>
                <Smartphone className={cn("w-5 h-5", status?.smsConfigured ? "text-success" : "text-ink-soft")} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">SMS Forwarding</h3>
                <p className="text-xs text-ink-soft">Forward portal SMS to auto-create leads</p>
              </div>
              <div className="ml-auto">
                {status?.smsConfigured
                  ? <span className="flex items-center gap-1 text-[11px] text-success"><CheckCircle2 className="w-3 h-3" /> Active</span>
                  : <span className="flex items-center gap-1 text-[11px] text-warning"><AlertCircle className="w-3 h-3" /> Not Set</span>
                }
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20">
              <Phone className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-mono text-ink flex-1">{status?.forwardingNumber || "Set FORWARDING_SMS_NUMBER"}</span>
              <CopyButton text={status?.forwardingNumber || ""} />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={cn(
              "p-5 rounded-2xl border transition-all",
              status?.emailConfigured
                ? "bg-success/5 border-success/20"
                : "bg-canvas border-line"
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                status?.emailConfigured ? "bg-success/20" : "bg-white/[0.06]"
              )}>
                <Mail className={cn("w-5 h-5", status?.emailConfigured ? "text-success" : "text-ink-soft")} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Email Forwarding</h3>
                <p className="text-xs text-ink-soft">Forward portal emails to auto-create leads</p>
              </div>
              <div className="ml-auto">
                {status?.emailConfigured
                  ? <span className="flex items-center gap-1 text-[11px] text-success"><CheckCircle2 className="w-3 h-3" /> Active</span>
                  : <span className="flex items-center gap-1 text-[11px] text-warning"><AlertCircle className="w-3 h-3" /> Not Set</span>
                }
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20">
              <Inbox className="w-3.5 h-3.5 text-brand" />
              <span className="text-sm font-mono text-ink flex-1">{brokerEmail || status?.forwardingEmail || "Set FORWARDING_EMAIL"}</span>
              <CopyButton text={brokerEmail || status?.forwardingEmail || ""} />
            </div>
            {brokerEmail && (
              <p className="mt-2 text-[11px] text-ink-soft">
                Your personal address. Point the portal/Gmail auto-forward rule here — the portal stays the
                sender, routing is done by this address.
              </p>
            )}
          </motion.div>
        </div>

        {/* How It Works */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl app-card"
        >
          <h2 className="text-sm font-semibold text-ink mb-4">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-line">
              <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-brand">1</span>
              </div>
              <p className="text-xs text-ink-soft">You receive a new enquiry SMS or email from 99acres, MagicBricks, or another portal</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-line">
              <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-brand">2</span>
              </div>
              <p className="text-xs text-ink-soft">Forward that SMS/email to the Converza number/email above — don't change anything</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-line">
              <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-brand">3</span>
              </div>
              <p className="text-xs text-ink-soft">Converza auto-extracts the lead, creates it, and starts the AI calling pipeline immediately</p>
            </div>
          </div>
        </motion.div>

        {/* ═══ Portal Auto-Forward Wizard — set each portal ONCE, then zero work ═══ */}
        <PortalWizard
          forwardingEmail={brokerEmail || status?.forwardingEmail || ""}
          forwardingNumber={status?.forwardingNumber || ""}
        />

        {/* How to Forward — SMS & Email Sections */}
        <div className="space-y-3">
          {/* SMS Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl border border-line bg-canvas overflow-hidden"
          >
            <button
              onClick={() => toggleSection("sms")}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center">
                  <Smartphone className="w-4.5 h-4.5 text-brand" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-ink">Forward SMS from Your Phone</h3>
                  <p className="text-xs text-ink-soft">iPhone & Android — works with all SMS apps</p>
                </div>
              </div>
              {expandedSection === "sms" ? <ChevronUp className="w-4 h-4 text-ink-soft" /> : <ChevronDown className="w-4 h-4 text-ink-soft" />}
            </button>

            <AnimatePresence>
              {expandedSection === "sms" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-5 space-y-4"
                >
                  {/* Android instructions */}
                  <div className="p-4 rounded-xl bg-black/20 border border-line">
                    <h4 className="text-xs font-semibold text-ink mb-2 flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5" /> Android
                    </h4>
                    <ol className="space-y-2 text-xs text-ink-soft">
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">1.</span>
                        Open the SMS from the portal (99acres, MagicBricks, etc.)
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">2.</span>
                        Long-press the message and tap <strong className="text-ink">Forward</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">3.</span>
                        Enter this number: <strong className="text-ink font-mono">{status?.forwardingNumber}</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">4.</span>
                        Tap <strong className="text-ink">Send</strong> — the lead is automatically created!
                      </li>
                    </ol>
                  </div>

                  {/* iPhone instructions */}
                  <div className="p-4 rounded-xl bg-black/20 border border-line">
                    <h4 className="text-xs font-semibold text-ink mb-2 flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5" /> iPhone (iOS)
                    </h4>
                    <ol className="space-y-2 text-xs text-ink-soft">
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">1.</span>
                        Open the SMS from the portal
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">2.</span>
                        Tap and hold the message bubble, tap <strong className="text-ink">More...</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">3.</span>
                        Tap the forward arrow <strong className="text-ink">→</strong> in bottom-right
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">4.</span>
                        Enter this number: <strong className="text-ink font-mono">{status?.forwardingNumber}</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">5.</span>
                        Tap <strong className="text-ink">Send</strong>
                      </li>
                    </ol>
                  </div>

                  {/* Portal SMS examples */}
                  <div>
                    <h4 className="text-xs font-semibold text-ink mb-3">What portal SMS look like (they all work)</h4>
                    <div className="space-y-2">
                      {PORTAL_SMS_EXAMPLES.map((example, i) => (
                        <div key={i} className="p-3 rounded-xl bg-black/20 border border-line">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", example.bg, example.color)}>
                              {example.portal}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-soft font-mono leading-relaxed">
                            {example.template}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Email Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="rounded-2xl border border-line bg-canvas overflow-hidden"
          >
            <button
              onClick={() => toggleSection("email")}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center">
                  <Mail className="w-4.5 h-4.5 text-brand" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-ink">Forward Email from Your Inbox</h3>
                  <p className="text-xs text-ink-soft">Gmail, Outlook, or any email app</p>
                </div>
              </div>
              {expandedSection === "email" ? <ChevronUp className="w-4 h-4 text-ink-soft" /> : <ChevronDown className="w-4 h-4 text-ink-soft" />}
            </button>

            <AnimatePresence>
              {expandedSection === "email" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-5 space-y-4"
                >
                  <div className="p-4 rounded-xl bg-black/20 border border-line">
                    <h4 className="text-xs font-semibold text-ink mb-2 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Forwarding Email Setup
                    </h4>
                    <ol className="space-y-2 text-xs text-ink-soft">
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">1.</span>
                        Open the portal enquiry email in your inbox
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">2.</span>
                        Click <strong className="text-ink">Forward</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">3.</span>
                        Enter this email: <strong className="text-ink font-mono">{status?.forwardingEmail}</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-brand shrink-0">4.</span>
                        Send — Converza extracts the lead and starts the AI calling process
                      </li>
                    </ol>
                  </div>

                  {/* Email forwarding services */}
                  <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
                    <h4 className="text-xs font-semibold text-warning mb-2 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5" /> Note for best results
                    </h4>
                    <p className="text-xs text-ink-soft">
                      For automatic email forwarding, we recommend using an email forwarding service like
                      SendGrid Inbound Parse, Mailgun Routes, or CloudMailin. Connect them to forward
                      emails to our webhook at <strong className="text-ink font-mono">/api/v1/webhooks/email/incoming</strong>.
                      Contact support for setup assistance.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Test Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="p-5 rounded-2xl app-card"
        >
          <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <Send className="w-4 h-4 text-brand" />
            Test Lead Forwarding
          </h2>
          <p className="text-xs text-ink-soft mb-4">Simulate forwarding a lead by entering a phone number below. We'll create a test lead and trigger the AI call pipeline.</p>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-ink-soft mb-1 block">Lead's Phone Number</label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-line text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-brand/50 font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-ink-soft mb-1 block">Your Email (for email test)</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-line text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-brand/50"
              />
            </div>              <button
                onClick={testForwarding}
                disabled={sendingTest || !testPhone}
                className="px-4 py-2 rounded-lg bg-line-subtle text-white text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5 mt-5"
              >
                {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Test Forward
              </button>
          </div>
        </motion.div>

        {/* Recent Forwarded Leads */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="p-5 rounded-2xl app-card"
        >
          <h2 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-brand" />
            Recently Forwarded Leads
          </h2>

          {status?.recentLeads && status.recentLeads.length > 0 ? (
            <div className="space-y-2">
              {status.recentLeads.map((lead, i) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-black/20 border border-line hover:bg-black/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink truncate">{lead.name}</span>
                      <StatusBadge status={lead.status} />
                    </div>
                    <p className="text-[11px] text-ink-soft">
                      {lead.phone} · Source: {lead.source}
                    </p>
                  </div>
                  <span className="text-[10px] text-ink-soft shrink-0">
                    {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-black/20 border border-line text-center">
              <Send className="w-8 h-8 text-ink-soft mx-auto mb-2" />
              <p className="text-sm text-ink-soft">No forwarded leads yet</p>
              <p className="text-xs text-ink-soft mt-1">Forward an SMS or email to see leads here</p>
            </div>
          )}
        </motion.div>        {/* Detailed Twilio SMS Setup Guide */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="rounded-2xl border border-line bg-canvas overflow-hidden"
        >
          <button
            onClick={() => toggleSection("twilio-setup")}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-danger/15 flex items-center justify-center">
                <Phone className="w-4.5 h-4.5 text-danger" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-ink">Twilio SMS Setup Guide</h3>
                <p className="text-xs text-ink-soft">Set up a Twilio number to receive forwarded SMS from brokers</p>
              </div>
            </div>
            {expandedSection === "twilio-setup" ? <ChevronUp className="w-4 h-4 text-ink-soft" /> : <ChevronDown className="w-4 h-4 text-ink-soft" />}
          </button>

          <AnimatePresence>
            {expandedSection === "twilio-setup" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="px-5 pb-5 space-y-4"
              >
                {/* Step 1: Buy a number */}
                <div className="p-4 rounded-xl bg-black/20 border border-line">
                  <h4 className="text-xs font-semibold text-ink mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand/15 flex items-center justify-center text-[11px] font-bold text-brand">1</span>
                    Buy a Twilio Phone Number with SMS capability
                  </h4>
                  <ol className="space-y-2 text-xs text-ink-soft ml-8">
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">1.</span>
                      Log in to <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-1">Twilio Console <ExternalLink className="w-3 h-3" /></a>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">2.</span>
                      Go to <strong className="text-ink">Develop → Phone Numbers → Manage → Buy a number</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">3.</span>
                      Search for an Indian (+91) number and make sure <strong className="text-ink">SMS capability</strong> is checked
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">4.</span>
                      Click <strong className="text-ink">Buy</strong> — costs ~$1/month (₹85)
                    </li>
                  </ol>
                </div>

                {/* Step 2: Configure webhook */}
                <div className="p-4 rounded-xl bg-black/20 border border-line">
                  <h4 className="text-xs font-semibold text-ink mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand/15 flex items-center justify-center text-[11px] font-bold text-brand">2</span>
                    Configure the SMS Webhook URL
                  </h4>
                  <ol className="space-y-2 text-xs text-ink-soft ml-8">
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">1.</span>
                      Go to <strong className="text-ink">Develop → Phone Numbers → Manage → Active Numbers</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">2.</span>
                      Click on the number you just purchased
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">3.</span>
                      Scroll to the <strong className="text-ink">Messaging</strong> section
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">4.</span>
                      Set <strong className="text-ink">"A message comes in"</strong> to <strong className="text-ink">Webhook</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">5.</span>
                      Enter this URL (replace with your domain):
                      <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-line">
                        <code className="text-[11px] text-ink font-mono break-all">{window.location.origin}/api/v1/webhooks/sms/incoming</code>
                        <CopyButton text={`${window.location.origin}/api/v1/webhooks/sms/incoming`} />
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">6.</span>
                      Set HTTP method to <strong className="text-ink">POST</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">7.</span>
                      Click <strong className="text-ink">Save</strong>
                    </li>
                  </ol>
                </div>

                {/* Step 3: Set env vars */}
                <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
                  <h4 className="text-xs font-semibold text-warning mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Required Environment Variables
                  </h4>
                  <div className="space-y-2 ml-2">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-line">
                      <code className="text-[11px] text-ink font-mono">TWILIO_ACCOUNT_SID</code>
                      <span className="text-[10px] text-ink-soft">— Your Twilio Account SID</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-line">
                      <code className="text-[11px] text-ink font-mono">TWILIO_AUTH_TOKEN</code>
                      <span className="text-[10px] text-ink-soft">— Used to verify SMS webhook signatures</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-line">
                      <code className="text-[11px] text-ink font-mono">FORWARDING_SMS_NUMBER</code>
                      <span className="text-[10px] text-ink-soft">— The Twilio number (E.164 format, e.g. +919876543210)</span>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="p-4 rounded-xl bg-success/5 border border-success/10">
                  <h4 className="text-xs font-semibold text-success mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tips & Gotchas
                  </h4>
                  <ul className="space-y-1.5 text-xs text-ink-soft ml-2">
                    <li className="flex gap-2">
                      <span className="text-success shrink-0">→</span>
                      <strong className="text-ink">HTTPS required:</strong> Twilio won't send to non-HTTPS URLs. Your production URL is already HTTPS.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-success shrink-0">→</span>
                      <strong className="text-ink">Signature validation:</strong> We validate Twilio's X-Twilio-Signature header automatically
                    </li>
                    <li className="flex gap-2">
                      <span className="text-success shrink-0">→</span>
                      The phone number <strong className="text-ink">cannot</strong> be registered on any existing WhatsApp account
                    </li>
                    <li className="flex gap-2">
                      <span className="text-success shrink-0">→</span>
                      Only <strong className="text-ink">FORWARDING_SMS_NUMBER</strong> is required for the frontend. TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are needed for signature validation. MessageBird (<code className="text-brand">MESSAGEBIRD_API_KEY</code>) is also supported — point the inbound callback to <code className="text-brand">/api/v1/webhooks/sms/incoming-messagebird</code>
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Detailed Email Forwarding Setup Guide */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="rounded-2xl border border-line bg-canvas overflow-hidden"
        >
          <button
            onClick={() => toggleSection("email-setup")}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand/15 flex items-center justify-center">
                <Mail className="w-4.5 h-4.5 text-brand" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-ink">Email Forwarding Setup Guide</h3>
                <p className="text-xs text-ink-soft">Configure SendGrid Inbound Parse or Mailgun Routes to forward portal emails</p>
              </div>
            </div>
            {expandedSection === "email-setup" ? <ChevronUp className="w-4 h-4 text-ink-soft" /> : <ChevronDown className="w-4 h-4 text-ink-soft" />}
          </button>

          <AnimatePresence>
            {expandedSection === "email-setup" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="px-5 pb-5 space-y-4"
              >
                {/* DNS Setup */}
                <div className="p-4 rounded-xl bg-black/20 border border-line">
                  <h4 className="text-xs font-semibold text-ink mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand/15 flex items-center justify-center text-[11px] font-bold text-brand">1</span>
                    DNS Setup — Add MX Records
                  </h4>
                  <p className="text-xs text-ink-soft mb-3 ml-8">
                    Create a subdomain (e.g. <strong className="text-ink">forward.yourdomain.com</strong>) and add MX records pointing to your email forwarding provider.
                    Do NOT use your primary domain's MX records.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-8">
                    <div className="p-3 rounded-lg bg-black/30 border border-line">
                      <p className="text-xs font-semibold text-ink mb-1">SendGrid</p>
                      <p className="text-[10px] text-ink-soft font-mono">MX: <strong className="text-ink">mx.sendgrid.net</strong></p>
                      <p className="text-[10px] text-ink-soft">Priority: 10</p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/30 border border-line">
                      <p className="text-xs font-semibold text-ink mb-1">Mailgun</p>
                      <p className="text-[10px] text-ink-soft font-mono">MX: <strong className="text-ink">mxa.mailgun.org</strong></p>
                      <p className="text-[10px] text-ink-soft font-mono">MX: <strong className="text-ink">mxb.mailgun.org</strong></p>
                    </div>
                  </div>
                </div>

                {/* SendGrid Setup */}
                <div className="p-4 rounded-xl bg-black/20 border border-line">
                  <h4 className="text-xs font-semibold text-ink mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand/15 flex items-center justify-center text-[11px] font-bold text-brand">2</span>
                    Option A: SendGrid Inbound Parse
                  </h4>
                  <ol className="space-y-2 text-xs text-ink-soft ml-8">
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">1.</span>
                      Go to <strong className="text-ink">Settings → Inbound Parse</strong> in SendGrid dashboard
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">2.</span>
                      Add your subdomain (e.g. <strong className="text-ink">forward.yourdomain.com</strong>)
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">3.</span>
                      Set Destination URL to:
                      <div className="mt-1 p-2 rounded-lg bg-black/30 border border-line">
                        <code className="text-[11px] text-ink font-mono break-all">{window.location.origin}/api/v1/webhooks/email/incoming</code>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">4.</span>
                      Disable "Automatic Security" for this subdomain (to avoid loop)
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">5.</span>
                      Send a test email to <strong className="text-ink">anything@forward.yourdomain.com</strong>
                    </li>
                  </ol>
                  <div className="mt-3 p-3 rounded-lg bg-warning/5 border border-warning/10 ml-8">
                    <p className="text-[11px] text-warning">
                      <strong>Pricing:</strong> SendGrid Inbound Parse is included with paid plans (~$15-20/mo).
                      Check your plan for inbound parse limits.
                    </p>
                  </div>
                </div>

                {/* Mailgun Setup */}
                <div className="p-4 rounded-xl bg-black/20 border border-line">
                  <h4 className="text-xs font-semibold text-ink mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-brand/15 flex items-center justify-center text-[11px] font-bold text-brand">2</span>
                    Option B: Mailgun Routes
                  </h4>
                  <ol className="space-y-2 text-xs text-ink-soft ml-8">
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">1.</span>
                      Go to <strong className="text-ink">Sending → Receiving</strong> in Mailgun dashboard
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">2.</span>
                      Click <strong className="text-ink">Create Route</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">3.</span>
                      Set Expression Type: <strong className="text-ink">Match Recipient</strong> → <code className="text-ink font-mono">forward@yourdomain.com</code>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">4.</span>
                      Action: <strong className="text-ink">Forward</strong> to URL
                    </li>
                    <li className="flex gap-2">
                      <span className="text-brand shrink-0">5.</span>
                      Enter: <code className="text-[11px] text-ink font-mono break-all">{window.location.origin}/api/v1/webhooks/email/incoming</code>
                    </li>
                  </ol>
                  <div className="mt-3 p-3 rounded-lg bg-warning/5 border border-warning/10 ml-8">
                    <p className="text-[11px] text-warning">
                      <strong>Pricing:</strong> Mailgun free tier includes 1 route. Paid plans start at $15/mo for more.
                    </p>
                  </div>
                </div>

                {/* Set ENV */}
                <div className="p-4 rounded-xl bg-warning/5 border border-warning/10">
                  <h4 className="text-xs font-semibold text-warning mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Required Environment Variable
                  </h4>
                  <div className="p-2 rounded-lg bg-black/30 border border-line">
                    <code className="text-[11px] text-ink font-mono">FORWARDING_EMAIL=forward@converza.tech</code>
                  </div>
                  <p className="text-xs text-ink-soft mt-2">
                    Set this in your .env file so the frontend shows the correct forwarding email address.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Compatible Portals */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="p-5 rounded-2xl app-card"
        >
          <h2 className="text-sm font-semibold text-ink mb-3">Compatible Portals & Formats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "99acres", icon: "🏠", desc: "All enquiry SMS" },
              { name: "MagicBricks", icon: "🪄", desc: "All lead alerts" },
              { name: "JustDial", icon: "📞", desc: "All enquiry SMS" },
              { name: "Housing.com", icon: "🏡", desc: "All lead SMS" },
              { name: "CommonFloor", icon: "📐", desc: "All enquiry SMS" },
              { name: "Sulekha", icon: "📋", desc: "All lead SMS" },
              { name: "Facebook", icon: "👍", desc: "Lead ads SMS" },
              { name: "Manual Entry", icon: "✍️", desc: "Type any format" },
            ].map((portal, i) => (
              <div key={i} className="p-3 rounded-xl bg-black/20 border border-line text-center">
                <span className="text-xl mb-1 block">{portal.icon}</span>
                <p className="text-[12px] font-medium text-ink">{portal.name}</p>
                <p className="text-[10px] text-ink-soft">{portal.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-soft mt-4 text-center">
            Any SMS or email containing a phone number and name will be parsed automatically.
            Works even with non-standard formats.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

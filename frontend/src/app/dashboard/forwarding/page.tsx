"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Mail, CheckCircle2, XCircle, Loader2, Copy,
  ChevronDown, ChevronUp, Smartphone, Inbox, ArrowRight, Send,
  Phone, ExternalLink, AlertCircle, RefreshCw, History, Users,
} from "lucide-react";
import { toast } from "sonner";
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
    color: "text-green-400",
    bg: "bg-green-500/10",
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
    BOOKED: "text-green-400 border-green-500/20 bg-green-500/10",
    CONVERTED: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    COLD: "text-gray-400 border-gray-500/20 bg-gray-500/10",
  };
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", colors[status] || "text-gray-400 border-gray-500/20 bg-gray-500/10")}>
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
      className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
      title="Copy to clipboard"
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="p-5 rounded-2xl bg-white/5 border border-white/10 animate-pulse space-y-3">
      <div className="h-5 w-40 bg-white/10 rounded" />
      <div className="h-3 w-64 bg-white/5 rounded" />
      <div className="flex gap-2">
        <div className="h-8 w-32 bg-white/10 rounded-lg" />
        <div className="h-8 w-32 bg-white/10 rounded-lg" />
      </div>
    </div>
  );
}

export default function LeadForwardingPage() {
  const [status, setStatus] = useState<ForwardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>("sms");
  const [sendingTest, setSendingTest] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const [smsStatus, emailStatus, recentLeads] = await Promise.all([
        api.get<{ configured: boolean; forwardingNumber: string }>("/webhooks/sms/status").catch(() => null),
        api.get<{ configured: boolean; forwardingEmail: string }>("/webhooks/email/status").catch(() => null),
        api.get<{ leads: ForwardingStatus["recentLeads"] }>("/leads?source=sms_forward,email_forward_99acres,email_forward_magicbricks,email_forward_justdial&limit=10&sort=-createdAt").catch(() => null),
      ]);

      setStatus({
        smsConfigured: smsStatus?.configured || false,
        emailConfigured: emailStatus?.configured || false,
        forwardingNumber: smsStatus?.forwardingNumber || process.env.NEXT_PUBLIC_FORWARDING_SMS_NUMBER || "+919876543210",
        forwardingEmail: emailStatus?.forwardingEmail || process.env.NEXT_PUBLIC_FORWARDING_EMAIL || "forward@leadbridge.com",
        recentLeads: (recentLeads as any)?.leads?.slice(0, 5) || [],
      });
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
      <div className="min-h-screen bg-[#0A0A0F]">
        <header className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-lg border-b border-white/5">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-white/10 rounded" />
              <div className="h-3 w-48 bg-white/5 rounded" />
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
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0A0F]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4F6EF7] to-[#22D3A5] flex items-center justify-center">
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Lead Forwarding</h1>
            <p className="text-xs text-gray-500">Forward portal SMS/emails to auto-create leads with AI calling</p>
          </div>
          <button onClick={loadStatus} className="ml-auto p-2 rounded-lg hover:bg-white/5 text-gray-400 transition-colors" title="Refresh">
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
                ? "bg-green-500/5 border-green-500/20"
                : "bg-white/5 border-white/10"
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                status?.smsConfigured ? "bg-green-500/20" : "bg-white/10"
              )}>
                <Smartphone className={cn("w-5 h-5", status?.smsConfigured ? "text-green-400" : "text-gray-400")} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">SMS Forwarding</h3>
                <p className="text-xs text-gray-500">Forward portal SMS to auto-create leads</p>
              </div>
              <div className="ml-auto">
                {status?.smsConfigured
                  ? <span className="flex items-center gap-1 text-[11px] text-green-400"><CheckCircle2 className="w-3 h-3" /> Active</span>
                  : <span className="flex items-center gap-1 text-[11px] text-amber-400"><AlertCircle className="w-3 h-3" /> Not Set</span>
                }
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20">
              <Phone className="w-3.5 h-3.5 text-[#4F6EF7]" />
              <span className="text-sm font-mono text-white flex-1">{status?.forwardingNumber || "Set FORWARDING_SMS_NUMBER"}</span>
              <CopyButton text={status?.forwardingNumber || ""} />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={cn(
              "p-5 rounded-2xl border transition-all",
              status?.emailConfigured
                ? "bg-green-500/5 border-green-500/20"
                : "bg-white/5 border-white/10"
            )}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                status?.emailConfigured ? "bg-green-500/20" : "bg-white/10"
              )}>
                <Mail className={cn("w-5 h-5", status?.emailConfigured ? "text-green-400" : "text-gray-400")} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Email Forwarding</h3>
                <p className="text-xs text-gray-500">Forward portal emails to auto-create leads</p>
              </div>
              <div className="ml-auto">
                {status?.emailConfigured
                  ? <span className="flex items-center gap-1 text-[11px] text-green-400"><CheckCircle2 className="w-3 h-3" /> Active</span>
                  : <span className="flex items-center gap-1 text-[11px] text-amber-400"><AlertCircle className="w-3 h-3" /> Not Set</span>
                }
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20">
              <Inbox className="w-3.5 h-3.5 text-[#22D3A5]" />
              <span className="text-sm font-mono text-white flex-1">{status?.forwardingEmail || "Set FORWARDING_EMAIL"}</span>
              <CopyButton text={status?.forwardingEmail || ""} />
            </div>
          </motion.div>
        </div>

        {/* How It Works */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl bg-white/5 border border-white/10"
        >
          <h2 className="text-sm font-semibold text-white mb-4">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[#4F6EF7]/10 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-[#4F6EF7]">1</span>
              </div>
              <p className="text-xs text-gray-400">You receive a new enquiry SMS or email from 99acres, MagicBricks, or another portal</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[#22D3A5]/10 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-[#22D3A5]">2</span>
              </div>
              <p className="text-xs text-gray-400">Forward that SMS/email to the LeadBridge number/email above — don't change anything</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center mb-2">
                <span className="text-sm font-bold text-[#C9A84C]">3</span>
              </div>
              <p className="text-xs text-gray-400">LeadBridge auto-extracts the lead, creates it, and starts the AI calling pipeline immediately</p>
            </div>
          </div>
        </motion.div>

        {/* How to Forward — SMS & Email Sections */}
        <div className="space-y-3">
          {/* SMS Section */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
          >
            <button
              onClick={() => toggleSection("sms")}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#4F6EF7]/10 flex items-center justify-center">
                  <Smartphone className="w-4.5 h-4.5 text-[#4F6EF7]" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">Forward SMS from Your Phone</h3>
                  <p className="text-xs text-gray-500">iPhone & Android — works with all SMS apps</p>
                </div>
              </div>
              {expandedSection === "sms" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            <AnimatePresence>
              {expandedSection === "sms" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-5 space-y-4"
                >
                  {/* Android instructions */}
                  <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                    <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5" /> Android
                    </h4>
                    <ol className="space-y-2 text-xs text-gray-400">
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">1.</span>
                        Open the SMS from the portal (99acres, MagicBricks, etc.)
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">2.</span>
                        Long-press the message and tap <strong className="text-white">Forward</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">3.</span>
                        Enter this number: <strong className="text-white font-mono">{status?.forwardingNumber}</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">4.</span>
                        Tap <strong className="text-white">Send</strong> — the lead is automatically created!
                      </li>
                    </ol>
                  </div>

                  {/* iPhone instructions */}
                  <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                    <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5" /> iPhone (iOS)
                    </h4>
                    <ol className="space-y-2 text-xs text-gray-400">
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">1.</span>
                        Open the SMS from the portal
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">2.</span>
                        Tap and hold the message bubble, tap <strong className="text-white">More...</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">3.</span>
                        Tap the forward arrow <strong className="text-white">→</strong> in bottom-right
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">4.</span>
                        Enter this number: <strong className="text-white font-mono">{status?.forwardingNumber}</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#4F6EF7] shrink-0">5.</span>
                        Tap <strong className="text-white">Send</strong>
                      </li>
                    </ol>
                  </div>

                  {/* Portal SMS examples */}
                  <div>
                    <h4 className="text-xs font-semibold text-white mb-3">What portal SMS look like (they all work)</h4>
                    <div className="space-y-2">
                      {PORTAL_SMS_EXAMPLES.map((example, i) => (
                        <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded", example.bg, example.color)}>
                              {example.portal}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 font-mono leading-relaxed">
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
            className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
          >
            <button
              onClick={() => toggleSection("email")}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#22D3A5]/10 flex items-center justify-center">
                  <Mail className="w-4.5 h-4.5 text-[#22D3A5]" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white">Forward Email from Your Inbox</h3>
                  <p className="text-xs text-gray-500">Gmail, Outlook, or any email app</p>
                </div>
              </div>
              {expandedSection === "email" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            <AnimatePresence>
              {expandedSection === "email" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="px-5 pb-5 space-y-4"
                >
                  <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                    <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Forwarding Email Setup
                    </h4>
                    <ol className="space-y-2 text-xs text-gray-400">
                      <li className="flex gap-2">
                        <span className="text-[#22D3A5] shrink-0">1.</span>
                        Open the portal enquiry email in your inbox
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#22D3A5] shrink-0">2.</span>
                        Click <strong className="text-white">Forward</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#22D3A5] shrink-0">3.</span>
                        Enter this email: <strong className="text-white font-mono">{status?.forwardingEmail}</strong>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#22D3A5] shrink-0">4.</span>
                        Send — LeadBridge extracts the lead and starts the AI calling process
                      </li>
                    </ol>
                  </div>

                  {/* Email forwarding services */}
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5" /> Note for best results
                    </h4>
                    <p className="text-xs text-gray-400">
                      For automatic email forwarding, we recommend using an email forwarding service like
                      SendGrid Inbound Parse, Mailgun Routes, or CloudMailin. Connect them to forward
                      emails to our webhook at <strong className="text-white font-mono">/api/v1/webhooks/email/incoming</strong>.
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
          className="p-5 rounded-2xl bg-white/5 border border-white/10"
        >
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Send className="w-4 h-4 text-[#4F6EF7]" />
            Test Lead Forwarding
          </h2>
          <p className="text-xs text-gray-500 mb-4">Simulate forwarding a lead by entering a phone number below. We'll create a test lead and trigger the AI call pipeline.</p>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-gray-500 mb-1 block">Lead's Phone Number</label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#4F6EF7] font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-gray-500 mb-1 block">Your Email (for email test)</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#22D3A5]"
              />
            </div>              <button
                onClick={testForwarding}
                disabled={sendingTest || !testPhone}
                className="px-4 py-2 rounded-lg bg-[#4F6EF7] text-white text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5 mt-5"
              >
                {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Test Forward
              </button>
          </div>
        </motion.div>

        {/* Recent Forwarded Leads */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="p-5 rounded-2xl bg-white/5 border border-white/10"
        >
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-[#4F6EF7]" />
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-black/20 border border-white/5 hover:bg-black/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#4F6EF7]/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-[#4F6EF7]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{lead.name}</span>
                      <StatusBadge status={lead.status} />
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {lead.phone} · Source: {lead.source}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-600 shrink-0">
                    {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-black/20 border border-white/5 text-center">
              <Send className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No forwarded leads yet</p>
              <p className="text-xs text-gray-600 mt-1">Forward an SMS or email to see leads here</p>
            </div>
          )}
        </motion.div>        {/* Detailed Twilio SMS Setup Guide */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
        >
          <button
            onClick={() => toggleSection("twilio-setup")}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F43F5E]/10 flex items-center justify-center">
                <Phone className="w-4.5 h-4.5 text-[#F43F5E]" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-white">Twilio SMS Setup Guide</h3>
                <p className="text-xs text-gray-500">Set up a Twilio number to receive forwarded SMS from brokers</p>
              </div>
            </div>
            {expandedSection === "twilio-setup" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          <AnimatePresence>
            {expandedSection === "twilio-setup" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="px-5 pb-5 space-y-4"
              >
                {/* Step 1: Buy a number */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                  <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#4F6EF7]/10 flex items-center justify-center text-[11px] font-bold text-[#4F6EF7]">1</span>
                    Buy a Twilio Phone Number with SMS capability
                  </h4>
                  <ol className="space-y-2 text-xs text-gray-400 ml-8">
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">1.</span>
                      Log in to <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-[#4F6EF7] hover:underline inline-flex items-center gap-1">Twilio Console <ExternalLink className="w-3 h-3" /></a>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">2.</span>
                      Go to <strong className="text-white">Develop → Phone Numbers → Manage → Buy a number</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">3.</span>
                      Search for an Indian (+91) number and make sure <strong className="text-white">SMS capability</strong> is checked
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">4.</span>
                      Click <strong className="text-white">Buy</strong> — costs ~$1/month (₹85)
                    </li>
                  </ol>
                </div>

                {/* Step 2: Configure webhook */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                  <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#4F6EF7]/10 flex items-center justify-center text-[11px] font-bold text-[#4F6EF7]">2</span>
                    Configure the SMS Webhook URL
                  </h4>
                  <ol className="space-y-2 text-xs text-gray-400 ml-8">
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">1.</span>
                      Go to <strong className="text-white">Develop → Phone Numbers → Manage → Active Numbers</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">2.</span>
                      Click on the number you just purchased
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">3.</span>
                      Scroll to the <strong className="text-white">Messaging</strong> section
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">4.</span>
                      Set <strong className="text-white">"A message comes in"</strong> to <strong className="text-white">Webhook</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">5.</span>
                      Enter this URL (replace with your domain):
                      <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
                        <code className="text-[11px] text-white font-mono break-all">{window.location.origin}/api/v1/webhooks/sms/incoming</code>
                        <CopyButton text={`${window.location.origin}/api/v1/webhooks/sms/incoming`} />
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">6.</span>
                      Set HTTP method to <strong className="text-white">POST</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#4F6EF7] shrink-0">7.</span>
                      Click <strong className="text-white">Save</strong>
                    </li>
                  </ol>
                </div>

                {/* Step 3: Set env vars */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <h4 className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Required Environment Variables
                  </h4>
                  <div className="space-y-2 ml-2">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
                      <code className="text-[11px] text-white font-mono">TWILIO_ACCOUNT_SID</code>
                      <span className="text-[10px] text-gray-500">— Your Twilio Account SID</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
                      <code className="text-[11px] text-white font-mono">TWILIO_AUTH_TOKEN</code>
                      <span className="text-[10px] text-gray-500">— Used to verify SMS webhook signatures</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5">
                      <code className="text-[11px] text-white font-mono">FORWARDING_SMS_NUMBER</code>
                      <span className="text-[10px] text-gray-500">— The Twilio number (E.164 format, e.g. +919876543210)</span>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                  <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tips & Gotchas
                  </h4>
                  <ul className="space-y-1.5 text-xs text-gray-400 ml-2">
                    <li className="flex gap-2">
                      <span className="text-green-400 shrink-0">→</span>
                      <strong className="text-white">HTTPS required:</strong> Twilio won't send to non-HTTPS URLs. Use ngrok for local testing:
                      <code className="ml-1 text-[#4F6EF7] font-mono">ngrok http 3000</code>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 shrink-0">→</span>
                      <strong className="text-white">Signature validation:</strong> We validate Twilio's X-Twilio-Signature header automatically
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 shrink-0">→</span>
                      The phone number <strong className="text-white">cannot</strong> be registered on any existing WhatsApp account
                    </li>
                    <li className="flex gap-2">
                      <span className="text-green-400 shrink-0">→</span>
                      Only <strong className="text-white">FORWARDING_SMS_NUMBER</strong> is required for the frontend. TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are needed for signature validation
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Detailed Email Forwarding Setup Guide */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
        >
          <button
            onClick={() => toggleSection("email-setup")}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#22D3A5]/10 flex items-center justify-center">
                <Mail className="w-4.5 h-4.5 text-[#22D3A5]" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-white">Email Forwarding Setup Guide</h3>
                <p className="text-xs text-gray-500">Configure SendGrid Inbound Parse or Mailgun Routes to forward portal emails</p>
              </div>
            </div>
            {expandedSection === "email-setup" ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          <AnimatePresence>
            {expandedSection === "email-setup" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="px-5 pb-5 space-y-4"
              >
                {/* DNS Setup */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                  <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#22D3A5]/10 flex items-center justify-center text-[11px] font-bold text-[#22D3A5]">1</span>
                    DNS Setup — Add MX Records
                  </h4>
                  <p className="text-xs text-gray-400 mb-3 ml-8">
                    Create a subdomain (e.g. <strong className="text-white">forward.yourdomain.com</strong>) and add MX records pointing to your email forwarding provider.
                    Do NOT use your primary domain's MX records.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-8">
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                      <p className="text-xs font-semibold text-white mb-1">SendGrid</p>
                      <p className="text-[10px] text-gray-500 font-mono">MX: <strong className="text-white">mx.sendgrid.net</strong></p>
                      <p className="text-[10px] text-gray-500">Priority: 10</p>
                    </div>
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                      <p className="text-xs font-semibold text-white mb-1">Mailgun</p>
                      <p className="text-[10px] text-gray-500 font-mono">MX: <strong className="text-white">mxa.mailgun.org</strong></p>
                      <p className="text-[10px] text-gray-500 font-mono">MX: <strong className="text-white">mxb.mailgun.org</strong></p>
                    </div>
                  </div>
                </div>

                {/* SendGrid Setup */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                  <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#22D3A5]/10 flex items-center justify-center text-[11px] font-bold text-[#22D3A5]">2</span>
                    Option A: SendGrid Inbound Parse
                  </h4>
                  <ol className="space-y-2 text-xs text-gray-400 ml-8">
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">1.</span>
                      Go to <strong className="text-white">Settings → Inbound Parse</strong> in SendGrid dashboard
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">2.</span>
                      Add your subdomain (e.g. <strong className="text-white">forward.yourdomain.com</strong>)
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">3.</span>
                      Set Destination URL to:
                      <div className="mt-1 p-2 rounded-lg bg-black/30 border border-white/5">
                        <code className="text-[11px] text-white font-mono break-all">{window.location.origin}/api/v1/webhooks/email/incoming</code>
                      </div>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">4.</span>
                      Disable "Automatic Security" for this subdomain (to avoid loop)
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">5.</span>
                      Send a test email to <strong className="text-white">anything@forward.yourdomain.com</strong>
                    </li>
                  </ol>
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 ml-8">
                    <p className="text-[11px] text-amber-400">
                      <strong>Pricing:</strong> SendGrid Inbound Parse is included with paid plans (~$15-20/mo).
                      Check your plan for inbound parse limits.
                    </p>
                  </div>
                </div>

                {/* Mailgun Setup */}
                <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                  <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#22D3A5]/10 flex items-center justify-center text-[11px] font-bold text-[#22D3A5]">2</span>
                    Option B: Mailgun Routes
                  </h4>
                  <ol className="space-y-2 text-xs text-gray-400 ml-8">
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">1.</span>
                      Go to <strong className="text-white">Sending → Receiving</strong> in Mailgun dashboard
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">2.</span>
                      Click <strong className="text-white">Create Route</strong>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">3.</span>
                      Set Expression Type: <strong className="text-white">Match Recipient</strong> → <code className="text-white font-mono">forward@yourdomain.com</code>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">4.</span>
                      Action: <strong className="text-white">Forward</strong> to URL
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#22D3A5] shrink-0">5.</span>
                      Enter: <code className="text-[11px] text-white font-mono break-all">{window.location.origin}/api/v1/webhooks/email/incoming</code>
                    </li>
                  </ol>
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 ml-8">
                    <p className="text-[11px] text-amber-400">
                      <strong>Pricing:</strong> Mailgun free tier includes 1 route. Paid plans start at $15/mo for more.
                    </p>
                  </div>
                </div>

                {/* Set ENV */}
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Required Environment Variable
                  </h4>
                  <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                    <code className="text-[11px] text-white font-mono">FORWARDING_EMAIL=forward@leadbridge.com</code>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Set this in your .env file so the frontend shows the correct forwarding email address.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Compatible Portals */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="p-5 rounded-2xl bg-white/5 border border-white/10"
        >
          <h2 className="text-sm font-semibold text-white mb-3">Compatible Portals & Formats</h2>
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
              <div key={i} className="p-3 rounded-xl bg-black/20 border border-white/5 text-center">
                <span className="text-xl mb-1 block">{portal.icon}</span>
                <p className="text-[12px] font-medium text-white">{portal.name}</p>
                <p className="text-[10px] text-gray-500">{portal.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-4 text-center">
            Any SMS or email containing a phone number and name will be parsed automatically.
            Works even with non-standard formats.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

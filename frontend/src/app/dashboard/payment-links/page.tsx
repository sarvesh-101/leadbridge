"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Link, Plus, Search, Send, X, Loader2, CheckCircle2,
  XCircle, Clock, IndianRupee, ExternalLink, Copy,
  AlertTriangle,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";

interface PaymentLinkItem {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
  shortUrl: string;
  lead?: { name: string; phone: string };
  leadName?: string;
  leadPhone?: string;
  sentVia?: string;
  sentAt?: string;
  paidAt?: string;
  expiresAt?: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PAID: "bg-green-500/10 text-green-400 border-green-500/20",
  CANCELLED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  EXPIRED: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function PaymentLinksPage() {
  const [links, setLinks] = useState<PaymentLinkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      // Note: search is client-side only — backend supports leadId and status filters

      const [linksRes, summaryRes] = await Promise.all([
        api.get<{ items: PaymentLinkItem[]; total: number }>(`/payment-links?${params}`),
        api.get("/payment-links/summary").catch(() => null),
      ]);
      setLinks(linksRes.items || []);
      setTotal(linksRes.total || 0);
      setSummary(summaryRes);
    } catch (err: any) {
      toast.error(err.message || "Failed to load payment links");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  // Client-side search filtering since backend doesn't support search query
  const filteredLinks = search
    ? links.filter(l =>
        (l.lead?.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.description || "").toLowerCase().includes(search.toLowerCase()) ||
        l.amount.toString().includes(search)
      )
    : links;
  const displayLinks = search ? filteredLinks : links;

  const totalPages = Math.ceil(total / 20);

  async function handleCreate() {
    const amount = parseFloat(newAmount);
    if (!amount || amount <= 0) return toast.error("Enter a valid amount");
    setActionLoading("create");
    try {
      await api.post("/payment-links", {
        amount,
        description: newDescription || undefined,
      });
      toast.success("Payment link created");
      setShowCreate(false);
      setNewAmount("");
      setNewDescription("");
      setNewLeadName("");
      setNewLeadPhone("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create payment link");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSend(linkId: string, channel: "whatsapp" | "sms") {
    setActionLoading(`send-${linkId}`);
    try {
      await api.post(`/payment-links/${linkId}/send`, { channel });
      toast.success(`Payment link sent via ${channel}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to send payment link");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(linkId: string) {
    setActionLoading(`cancel-${linkId}`);
    try {
      await api.patch(`/payment-links/${linkId}/cancel`);
      toast.success("Payment link cancelled");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel payment link");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Links</h1>
          <p className="text-gray-400 mt-1">Create and share payment links with leads</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> New Payment Link
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total", value: summary.total, icon: Link, color: "text-blue-400" },
            { label: "Paid", value: summary.paid, icon: CheckCircle2, color: "text-green-400" },
            { label: "Pending", value: summary.pending, icon: Clock, color: "text-amber-400" },
            { label: "Collected", value: `₹${(summary.totalCollected || 0).toLocaleString("en-IN")}`, icon: IndianRupee, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
              <s.icon className={cn("w-5 h-5 mb-2", s.color)} />
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
          />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm"
        >
          <option value="all">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />)}</div>
      ) : displayLinks.length === 0 ? (
        <EmptyState icon={Link} title="No payment links yet" description="Create your first payment link to collect payments from leads"
          action={{ label: "Create Payment Link", onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="space-y-3">
          {displayLinks.map((link, i) => (
            <motion.div key={link.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F6EF7]/20 to-[#6B8AFF]/20 flex items-center justify-center shrink-0">
                <IndianRupee className="w-5 h-5 text-[#4F6EF7]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-white font-mono">₹{link.amount.toLocaleString("en-IN")}</span>
                  <span className={cn("text-[11px] px-1.5 py-0.5 rounded-full border", STATUS_STYLES[link.status])}>
                    {link.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                  {link.lead?.name && <span>{link.lead.name}</span>}
                  {link.description && <span>• {link.description}</span>}
                  <span>• {formatDate(link.createdAt)}</span>
                  {link.paidAt && <span className="text-green-400">• Paid {formatDate(link.paidAt)}</span>}
                </div>
                {link.shortUrl && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-[11px] text-[#4F6EF7] bg-[#4F6EF7]/5 px-1.5 py-0.5 rounded truncate max-w-[200px]">{link.shortUrl}</code>
                    <button onClick={() => { navigator.clipboard.writeText(link.shortUrl); toast.success("Copied!"); }}
                      className="p-0.5 text-gray-500 hover:text-white transition-colors">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {link.status === "PENDING" && (
                  <>
                    <button onClick={() => handleSend(link.id, "whatsapp")}
                      disabled={actionLoading === `send-${link.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-[#22D3A5]/10 text-[#22D3A5] hover:bg-[#22D3A5]/20 transition-colors">
                      {actionLoading === `send-${link.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send
                    </button>
                    <button onClick={() => handleCancel(link.id)}
                      disabled={actionLoading === `cancel-${link.id}`}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Cancel">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                <a href={link.shortUrl} target="_blank" rel="noopener noreferrer"
                  className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors" title="Open link">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          ))}
          <Pagination currentPage={page} totalPages={totalPages} total={total} pageSize={20} onPageChange={setPage} />
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl bg-[#111118] border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">New Payment Link</h2>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Amount (₹) *</label>
                  <input value={newAmount} onChange={(e) => setNewAmount(e.target.value)} type="number" min={1}
                    placeholder="e.g., 50000"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Description</label>
                  <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="e.g., Booking fee for 3BHK Apartment"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
                  />
                </div>                      <p className="text-xs text-gray-500 bg-white/[0.03] px-3 py-2 rounded-lg">
                  To associate a lead, create the payment link from the lead&apos;s detail page.
                </p>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button onClick={() => setShowCreate(false)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm hover:bg-white/5"
                  >Cancel</button>
                  <button onClick={handleCreate} disabled={!newAmount || actionLoading === "create"}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {actionLoading === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                    Create Link
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

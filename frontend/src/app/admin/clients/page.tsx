"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus, Search, Users, Phone, Calendar, MoreVertical,
  Loader2, Shield, CheckCircle, XCircle, AlertCircle,
  Building2, Mail, MapPin,
} from "lucide-react";
import { Pagination } from "@/components/shared/Pagination";

interface AdminClient {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  zone?: string;
  plan: string;
  planStatus: string;
  callsThisMonth: number;
  callsLimit: number;
  createdAt: string;
  territory?: { id: string; city: string; zone?: string } | null;
  _count?: { leads: number; calls: number; bookings: number };
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const limit = 20;

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      const res = await api.get<{ clients: AdminClient[]; total: number }>(`/admin/clients?${params}`);
      setClients(res.clients);
      setTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load clients:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleStatusChange(clientId: string, status: string) {
    setActionLoading(`${clientId}-status`);
    try {
      await api.patch(`/admin/clients/${clientId}/status`, { status });
      toast.success(`Status updated to ${status}`);
      setOpenMenu(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetPassword(clientId: string) {
    setActionLoading(`${clientId}-pwd`);
    try {
      const res = await api.post<{ temporaryPassword: string; userEmail: string }>(`/admin/clients/${clientId}/reset-password`);
      toast.success(`Temporary password: ${res.temporaryPassword}`, { duration: 15000 });
      setOpenMenu(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setActionLoading(null);
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-500/10 text-green-400";
      case "TRIAL": return "bg-blue-500/10 text-blue-400";
      case "PAST_DUE": return "bg-yellow-500/10 text-yellow-400";
      case "CANCELLED": return "bg-red-500/10 text-red-400";
      default: return "bg-gray-500/10 text-gray-400";
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-gray-400 mt-1">{total} total clients</p>
        </div>
        <Link href="/admin/clients/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Add Client
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, email, or business..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
        />
      </div>

      {/* Clients Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-white/5 border border-white/10">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <h3 className="text-lg font-medium text-white mb-2">No clients found</h3>
          <p className="text-sm text-gray-500 mb-6">
            {search ? "Try a different search term" : "Start by adding your first client"}
          </p>
          {!search && (
            <Link href="/admin/clients/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Client
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client, i) => (
            <motion.div key={client.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all relative"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-leadflow-500/20 to-leadflow-accent/20 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-leadflow-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white">{client.businessName}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", statusColor(client.planStatus))}>
                    {client.planStatus}
                  </span>
                  <span className="text-xs text-gray-500">{client.plan}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {client.city}{client.zone ? ` - ${client.zone}` : ""}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {client.callsThisMonth}/{client.callsLimit}</span>
                  {client._count && (
                    <>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {client._count.leads} leads</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {client._count.bookings} bookings</span>
                    </>
                  )}
                </div>
              </div>
              <div className="relative shrink-0">
                <button onClick={() => setOpenMenu(openMenu === client.id ? null : client.id)}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                >
                  {actionLoading === `${client.id}-status` || actionLoading === `${client.id}-pwd` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MoreVertical className="w-4 h-4" />
                  )}
                </button>
                {openMenu === client.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-[#1A1A24] border border-white/10 shadow-xl overflow-hidden">
                      <div className="py-1">
                        {["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED"].map((status) => (
                          <button key={status} onClick={() => handleStatusChange(client.id, status)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                          >
                            Set {status}
                          </button>
                        ))}
                        <hr className="border-white/10 my-1" />
                        <button onClick={() => handleResetPassword(client.id)}
                          className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                        >
                          Reset Password
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        total={total}
        pageSize={limit}
        onPageChange={setPage}
        loading={loading}
      />
    </div>
  );
}

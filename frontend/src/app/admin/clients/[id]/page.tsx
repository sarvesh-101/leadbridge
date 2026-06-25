"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Globe,
  Users, Calendar, CreditCard, Loader2, Key, Activity,
} from "lucide-react";

export default function AdminClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) loadClient();
  }, [params.id]);

  async function loadClient() {
    setLoading(true);
    try {
      const res = await api.get(`/admin/clients/${params.id}`);
      setClient(res.client);
    } catch (err: any) {
      toast.error("Failed to load client");
      router.push("/admin/clients");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setActionLoading("reset-pwd");
    try {
      const res = await api.post<{ temporaryPassword: string; userEmail: string }>(`/admin/clients/${params.id}/reset-password`);
      toast.success(`Temporary password: ${res.temporaryPassword}`, { duration: 15000 });
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleStatusChange(status: string) {
    setActionLoading(`status-${status}`);
    try {
      await api.patch(`/admin/clients/${params.id}/status`, { status });
      toast.success(`Status updated to ${status}`);
      await loadClient();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#4F6EF7] animate-spin" />
      </div>
    );
  }

  if (!client) return null;

  const statusColor = (s: string) => {
    switch (s) {
      case "ACTIVE": return "bg-green-500/10 text-green-400";
      case "TRIAL": return "bg-blue-500/10 text-blue-400";
      case "PAST_DUE": return "bg-yellow-500/10 text-yellow-400";
      case "CANCELLED": return "bg-red-500/10 text-red-400";
      default: return "bg-gray-500/10 text-gray-400";
    }
  };

  const usagePercent = client.callsLimit > 0 ? Math.round((client.callsThisMonth / client.callsLimit) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-[#1A1A24] text-[#6B6B8A]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{client.businessName}</h1>
            <span className={cn("text-xs px-2 py-0.5 rounded", statusColor(client.planStatus))}>
              {client.planStatus}
            </span>
            <span className="text-xs text-gray-500">{client.plan}</span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{client.ownerName} · {client.email}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: client._count?.leads || 0, icon: Users, color: "text-blue-400" },
          { label: "Total Calls", value: client._count?.calls || 0, icon: Phone, color: "text-purple-400" },
          { label: "Bookings", value: client._count?.bookings || 0, icon: Calendar, color: "text-green-400" },
          { label: "Call Usage", value: `${client.callsThisMonth}/${client.callsLimit}`, icon: Activity, color: usagePercent > 80 ? "text-red-400" : "text-yellow-400" },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={cn("w-4 h-4", stat.color)} />
              <span className="text-xs text-gray-500">{stat.label}</span>
            </div>
            <div className={cn("text-xl font-bold text-white", stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Usage Bar */}
      <div className="p-5 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-white">Monthly Call Usage</h3>
          <span className={cn("text-sm font-mono", usagePercent > 80 ? "text-red-400" : "text-gray-400")}>
            {client.callsThisMonth} / {client.callsLimit} ({usagePercent}%)
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#1A1A24] overflow-hidden">
          <div className={cn(
            "h-full rounded-full transition-all",
            usagePercent > 80 ? "bg-red-500" : usagePercent > 60 ? "bg-yellow-500" : "bg-[#4F6EF7]"
          )} style={{ width: `${Math.min(usagePercent, 100)}%` }} />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-4">Business Details</h3>
          <div className="space-y-3">
            <DetailRow icon={Building2} label="Business" value={client.businessName} />
            <DetailRow icon={Mail} label="Email" value={client.email} />
            <DetailRow icon={Phone} label="Phone" value={client.phone} />
            <DetailRow icon={MapPin} label="Location" value={`${client.city}${client.zone ? ` - ${client.zone}` : ""}`} />
            <DetailRow icon={Globe} label="Territory" value={client.territory ? `${client.territory.city}${client.territory.zone ? ` - ${client.territory.zone}` : ""}` : "—"} />
            <DetailRow icon={Users} label="Owner" value={client.ownerName} />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-semibold text-white mb-4">Plan & Billing</h3>
          <div className="space-y-3">
            <DetailRow icon={CreditCard} label="Plan" value={client.plan} />
            <DetailRow icon={Activity} label="Status" value={client.planStatus} />
            <DetailRow icon={Calendar} label="Trial Ends" value={client.trialEndsAt ? new Date(client.trialEndsAt).toLocaleDateString() : "—"} />
            <DetailRow icon={Key} label="WhatsApp" value={client.ownerWhatsapp || "—"} />
            <DetailRow icon={Activity} label="Calls Limit" value={`${client.callsLimit}/mo`} />
            <DetailRow icon={Activity} label="Language" value={client.language || "hinglish"} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => handleStatusChange("ACTIVE")} disabled={actionLoading?.startsWith("status")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/20 disabled:opacity-50"
        >
          {actionLoading === "status-ACTIVE" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Activate
        </button>
        <button onClick={() => handleStatusChange("PAST_DUE")} disabled={actionLoading?.startsWith("status")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 disabled:opacity-50"
        >
          {actionLoading === "status-PAST_DUE" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Mark Past Due
        </button>
        <button onClick={() => handleStatusChange("CANCELLED")} disabled={actionLoading?.startsWith("status")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 disabled:opacity-50"
        >
          {actionLoading === "status-CANCELLED" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Deactivate
        </button>
        <button onClick={handleResetPassword} disabled={actionLoading === "reset-pwd"}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 disabled:opacity-50"
        >
          {actionLoading === "reset-pwd" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
          Reset Password
        </button>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-500 shrink-0" />
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <span className="text-sm text-white truncate">{value}</span>
    </div>
  );
}

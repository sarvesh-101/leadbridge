"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { Search, MessageSquare, Phone, Mail, Check, Clock, X } from "lucide-react";

export default function MessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    try {
      const [callsRes, leadsRes] = await Promise.all([
        api.get("/calls?limit=20"),
        api.get("/leads?limit=20"),
      ]);

      // Build message history from calls
      const callMessages = (callsRes.calls || []).map((call: any) => ({
        id: `call-${call.id}`,
        to: call.lead?.name || "Unknown",
        phone: call.lead?.phone || "",
        type: "phone",
        template: call.type || "QUALIFICATION",
        status: call.status === "COMPLETED" ? "completed" :
                call.status === "NO_ANSWER" ? "failed" : "sent",
        date: call.createdAt,
        content: call.summary || `Call duration: ${call.duration || 0}s`,
        duration: call.duration,
      }));

      // Build message history from leads (notifications)
      const leadMessages = leadsRes.leads?.slice(0, 10).map((lead: any) => ({
        id: `lead-${lead.id}`,
        to: lead.name,
        phone: lead.phone,
        type: "whatsapp",
        template: "Lead Notification",
        status: lead.status === "CONVERTED" ? "delivered" :
                lead.status === "BOOKED" ? "read" :
                lead.status === "CALLING" ? "sent" : "pending",
        date: lead.updatedAt || lead.createdAt,
        content: `Lead from ${lead.source} — ${lead.status.replace(/_/g, " ")}`,
      }));

      const all = [...callMessages, ...leadMessages].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setMessages(all.slice(0, 30));
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = messages.filter((m) => {
    const matchSearch = m.to.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
    const matchChannel = channelFilter === "all" || m.type === channelFilter;
    return matchSearch && matchChannel;
  });

  const channelCounts = {
    whatsapp: messages.filter((m) => m.type === "whatsapp").length,
    phone: messages.filter((m) => m.type === "phone").length,
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "delivered": case "completed": return <Check className="w-3.5 h-3.5 text-green-400" />;
      case "sent": return <Clock className="w-3.5 h-3.5 text-blue-400" />;
      case "read": return <Check className="w-3.5 h-3.5 text-blue-400" />;
      case "failed": return <X className="w-3.5 h-3.5 text-red-400" />;
      default: return <Clock className="w-3.5 h-3.5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-gray-400 mt-1">Call history and communication log</p>
      </div>

      {/* Channel Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: MessageSquare, label: "Notifications", count: channelCounts.whatsapp, color: "text-green-400" },
          { icon: Phone, label: "Calls", count: channelCounts.phone, color: "text-blue-400" },
        ].map((c) => (
          <div key={c.label} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            {loading ? (
              <div className="animate-pulse"><div className="h-7 w-12 bg-white/10 rounded mx-auto" /></div>
            ) : (
              <>
                <c.icon className={cn("w-5 h-5 mx-auto mb-2", c.color)} />
                <div className="text-xl font-bold text-white">{c.count}</div>
                <div className="text-xs text-gray-500">{c.label}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50" />
        </div>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm">
          <option value="all">All Channels</option>
          <option value="whatsapp">Notifications</option>
          <option value="phone">Calls</option>
        </select>
      </div>

      {/* Message List */}
      <div className="space-y-3">
        {loading ? (
          <div className="animate-pulse space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-white/5 rounded-xl" />)}</div>
        ) : filtered.length > 0 ? (
          filtered.map((msg, i) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  {msg.type === "phone" ? <Phone className="w-4 h-4 text-blue-400" /> : <MessageSquare className="w-4 h-4 text-green-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-white truncate">{msg.to}</span>
                      {msg.phone && <span className="text-xs text-gray-500 truncate">{msg.phone}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">{formatDate(msg.date)}</span>
                      {statusIcon(msg.status)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400">{msg.template}</span>
                    <span className={cn("text-xs", msg.status === "failed" ? "text-red-400" : "text-gray-500")}>{msg.status}</span>
                    {msg.duration && <span className="text-xs text-gray-500">{msg.duration}s</span>}
                  </div>
                  <p className="text-sm text-gray-400 mt-2 line-clamp-2">{msg.content}</p>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-500 text-sm">No messages found</div>
        )}
      </div>
    </div>
  );
}

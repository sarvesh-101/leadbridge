"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";import { ArrowLeft, RefreshCw, MessageSquare, Bot, User, Send,
  ExternalLink, Loader2, Zap, Phone, AlertTriangle,
} from "lucide-react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { customerApi } from "@/lib/customer-api";

interface ChatMessage {
  id: string;
  type: string;
  message: string;
  status: string;
  sentAt: string;
  channel: string;
}

export default function CustomerChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [clientContact, setClientContact] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = sessionStorage.getItem("customer_token");
    if (!token) {
      router.push("/customer/login");
      return;
    }
    const data = sessionStorage.getItem("customer_data");
    if (data) {
      const parsed = JSON.parse(data);
      setCustomer(parsed);
      setClientContact(parsed.clientContact || "");
    }
    loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadChat() {
    const token = sessionStorage.getItem("customer_token");
    if (!token) return;

    setLoading(true);
    try {
      const data = await customerApi.get("/customer/chat-history");
      setMessages(data.messages || []);
    } catch (err: any) {
      if (err.message === "Session expired") return; // handled by customerApi
      toast.error(err.message || "Failed to load chat history");
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  // Group messages by date
  const grouped: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const dateLabel = formatDate(msg.sentAt);
    if (dateLabel !== currentDate) {
      currentDate = dateLabel;
      grouped.push({ date: dateLabel, messages: [msg] });
    } else {
      grouped[grouped.length - 1].messages.push(msg);
    }
  }

  const waLink = clientContact
    ? `https://wa.me/${clientContact.replace(/\D/g, "")}?text=${encodeURIComponent("Namaste! I have a question about my property visit.")}`
    : null;

  return (
    <div className="min-h-screen bg-[#0A0F0C] aurora-backdrop">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0A0F0C]/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push("/customer/dashboard")} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#34D399] to-[#34D399] flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-[#F0F7F3]">WhatsApp Chat</h1>
            <p className="text-[10px] text-green-400">AI Assistant</p>
          </div>
          <button onClick={loadChat} className="p-2 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6] transition-colors">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Chat Messages */}
        <ErrorBoundary fallback={
          <div className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">Failed to load chat history.</p>
            <p className="text-xs text-[#9FB0A6] mt-1">You can still contact your broker via WhatsApp.</p>
          </div>
        }>
        <div className="space-y-4 mb-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse" style={{ justifyContent: i % 2 === 0 ? "flex-end" : "flex-start" }}>
                  <div className={cn("w-3/4 h-12 rounded-2xl bg-[#101713]")} />
                </div>
              ))}
            </div>
          ) : messages.length > 0 ? (
            grouped.map((group, gi) => (
              <div key={gi}>
                {/* Date separator */}
                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className="flex-1 h-px bg-[#101713]" />
                  <span className="text-[10px] text-gray-600 font-medium">{group.date}</span>
                  <div className="flex-1 h-px bg-[#101713]" />
                </div>

                <div className="space-y-3">
                  {group.messages.map((msg, mi) => {
                    const isBot = msg.type === "CHATBOT_REPLY" || msg.type === "OTP_SENT";
                    const isIncoming = msg.type === "INCOMING_WHATSAPP";

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: Math.min((gi + mi) * 0.02, 0.3) }}
                        className={cn(
                          "flex gap-2.5 max-w-[85%]",
                          isBot || isIncoming ? "" : "ml-auto flex-row-reverse"
                        )}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
                          isBot
                            ? "bg-gradient-to-br from-[#34D399] to-[#34D399]"
                            : isIncoming
                              ? "bg-[#34D399]/25"
                              : "bg-white/[0.06]"
                        )}>
                          {isBot ? (
                            <Bot className="w-3.5 h-3.5 text-[#F0F7F3]" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-[#9FB0A6]" />
                          )}
                        </div>

                        {/* Message bubble */}
                        <div>
                          <div className={cn(
                            "px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed",
                            isBot
                              ? "bg-[#34D399]/15 border border-[#34D399]/50/15 text-[#9FB0A6] rounded-tl-sm"
                              : isIncoming
                                ? "bg-[#34D399]/15 border border-[#34D399]/50/15 text-[#9FB0A6]"
                                : "bg-[#1B4332] text-white rounded-tr-sm"
                          )}>
                            {msg.type === "OTP_SENT" ? (
                              <div className="flex items-center gap-1.5">
                                <span>🔐 OTP sent via {msg.channel}</span>
                              </div>
                            ) : (
                              msg.message
                            )}
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 mt-0.5",
                            isBot || isIncoming ? "" : "justify-end"
                          )}>
                            <span className="text-[9px] text-gray-600">{formatTime(msg.sentAt)}</span>
                            {msg.status === "sent" && !isIncoming && (
                              <span className="text-[9px] text-gray-600">✓</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <h2 className="text-sm font-semibold text-[#F0F7F3] mb-1">No Messages Yet</h2>
              <p className="text-xs text-[#9FB0A6] mb-4">
                Start a conversation with the AI assistant on WhatsApp
              </p>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
        </ErrorBoundary>

        {/* Fixed bottom bar with WhatsApp link */}
        <div className="sticky bottom-4 app-card rounded-2xl p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-[#F0F7F3] font-medium">Chat with AI Assistant</p>
              <p className="text-[10px] text-[#9FB0A6]">Reply on WhatsApp for quick help</p>
            </div>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#34D399] text-white text-xs font-medium hover:bg-[#065F46] transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Open WhatsApp
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <a
                href={`tel:${customer?.clientContact}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white text-xs font-medium hover:opacity-90 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Broker
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

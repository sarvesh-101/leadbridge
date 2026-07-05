"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Search, MessageSquare, Phone, Send, Loader2, ChevronLeft,
  User, Clock, CheckCheck, AlertCircle, Paperclip,
} from "lucide-react";
import { useWebSocket } from "@/lib/websocket";
import type { LeadStatus } from "@/types";

interface ConversationItem {
  leadId: string;
  name: string;
  phone: string;
  status: string;
  source: string;
  score: number;
  lastMessage: { type: string; channel: string; message: string; status: string; sentAt: string } | null;
  messageCount: number;
}

interface ChatMessage {
  id: string;
  type: string;
  channel: string;
  message: string;
  status: string;
  sentAt: string;
  isFromLead: boolean;
  isFromBot: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting",
  CALLING: "Calling...",
  BOOKED: "Visit Booked",
  REMINDED: "Reminded",
  VISITED: "Visited",
  NO_SHOW: "No Show",
  CONVERTED: "Converted",
  COLD: "Cold",
};

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await api.get(`/messages/conversations${params}`);
      setConversations(data.conversations || []);
    } catch (err: any) {
      if (!selectedLeadId) toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [search, selectedLeadId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (leadId: string) => {
    try {
      const data = await api.get(`/messages/conversations/${leadId}`);
      setMessages(data.messages || []);
      // Mark as read
      api.post(`/messages/conversations/${leadId}/read`).catch(() => {});
    } catch {
      toast.error("Failed to load messages");
    }
  }, []);

  useEffect(() => {
    if (selectedLeadId) {
      loadMessages(selectedLeadId);
      setShowMobileList(false);
    }
  }, [selectedLeadId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-refresh conversations every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selectedLeadId) loadMessages(selectedLeadId);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadConversations, loadMessages, selectedLeadId]);

  // WebSocket real-time updates
  useWebSocket("lead.status_changed", useCallback(() => {
    loadConversations();
    if (selectedLeadId) loadMessages(selectedLeadId);
  }, [loadConversations, loadMessages, selectedLeadId]));

  useWebSocket("message.new", useCallback(() => {
    loadConversations();
    if (selectedLeadId) loadMessages(selectedLeadId);
  }, [loadConversations, loadMessages, selectedLeadId]));

  async function handleSend() {
    const text = inputText.trim();
    if (!text || !selectedLeadId) return;

    setSending(true);
    try {
      await api.post("/messages/send", {
        leadId: selectedLeadId,
        message: text,
      });
      setInputText("");
      // Reload messages and conversations
      await Promise.all([
        loadMessages(selectedLeadId),
        loadConversations(),
      ]);
      // Focus back on input
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function getUnreadCount(conversation: ConversationItem): number {
    // Count messages that are incoming and not yet replied to
    return conversation.lastMessage?.type === "INCOMING_WHATSAPP" &&
           conversation.lastMessage?.status === "received" ? 1 : 0;
  }

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const selectedConversation = conversations.find((c) => c.leadId === selectedLeadId);

  return (
    <div className="h-[calc(100vh-8rem)] -mx-4 sm:-mx-6 lg:-mx-8">
      <div className="flex h-full bg-[#0A0A0F]">
        {/* Conversation List */}
        <div className={cn(
          "w-full sm:w-80 lg:w-96 border-r border-white/5 flex flex-col bg-[#111118]",
          !showMobileList && "hidden sm:flex"
        )}>
          {/* Header */}
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white mb-3">Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-white/5 rounded w-24" />
                      <div className="h-2.5 bg-white/5 rounded w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => {
                const unread = getUnreadCount(conv);
                return (
                  <button
                    key={conv.leadId}
                    onClick={() => setSelectedLeadId(conv.leadId)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5",
                      selectedLeadId === conv.leadId && "bg-[#4F6EF7]/10"
                    )}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F6EF7]/20 to-[#6B8AFF]/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-[#4F6EF7]">{conv.name[0]}</span>
                      </div>
                      {unread > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#4F6EF7] border-2 border-[#111118]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white truncate">{conv.name}</span>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                            {formatDate(conv.lastMessage.sentAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate">
                          {conv.lastMessage ? conv.lastMessage.message : "No messages yet"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded",
                          conv.status === "BOOKED" ? "bg-green-500/10 text-green-400" :
                          conv.status === "CONVERTED" ? "bg-emerald-500/10 text-emerald-400" :
                          conv.status === "COLD" ? "bg-gray-500/10 text-gray-400" :
                          "bg-white/5 text-gray-500"
                        )}>
                          {STATUS_LABELS[conv.status] || conv.status}
                        </span>
                        {conv.score > 0 && (
                          <span className={cn(
                            "text-[10px]",
                            conv.score >= 70 ? "text-green-400" :
                            conv.score >= 40 ? "text-amber-400" : "text-gray-500"
                          )}>
                            {conv.score}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No conversations yet</p>
                <p className="text-xs text-gray-600 mt-1">Messages from leads will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Pane */}
        <div className={cn(
          "flex-1 flex flex-col bg-[#0A0A0F]",
          showMobileList && "hidden sm:flex"
        )}>
          {selectedLeadId && selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#111118]">
                <button onClick={() => { setSelectedLeadId(null); setShowMobileList(true); }}
                  className="sm:hidden p-1 -ml-1 rounded-lg hover:bg-white/5"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-400" />
                </button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4F6EF7]/20 to-[#6B8AFF]/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-medium text-[#4F6EF7]">{selectedConversation.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{selectedConversation.name}</span>
                    <a href={`tel:${selectedConversation.phone}`} className="text-[10px] text-gray-500 hover:text-[#4F6EF7]">
                      {selectedConversation.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{selectedConversation.source}</span>
                    <span>·</span>
                    <span>{STATUS_LABELS[selectedConversation.status] || selectedConversation.status}</span>
                  </div>
                </div>
                <a href={`https://wa.me/${selectedConversation.phone.replace(/\D/g, "")}`} target="_blank"
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                  title="Open in WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </a>
                <a href={`tel:${selectedConversation.phone}`}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                  title="Call"
                >
                  <Phone className="w-4 h-4" />
                </a>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No messages yet</p>
                    <p className="text-xs text-gray-600 mt-1">Send a message to start the conversation</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isLead = msg.isFromLead;
                    const isBot = msg.isFromBot;
                    const showAvatar = i === 0 || messages[i - 1]?.isFromLead !== isLead;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("flex gap-2", isLead ? "" : "flex-row-reverse")}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-medium",
                          showAvatar ? "flex" : "invisible",
                          isLead
                            ? "bg-[#4F6EF7]/20 text-[#4F6EF7]"
                            : isBot
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-green-500/20 text-green-400"
                        )}>
                          {isLead ? selectedConversation.name[0] : isBot ? "AI" : "B"}
                        </div>

                        {/* Bubble */}
                        <div className={cn(
                          "max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
                          isLead
                            ? "bg-white/10 text-white rounded-tl-sm"
                            : "bg-[#4F6EF7] text-white rounded-tr-sm"
                        )}>
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                          <div className={cn(
                            "flex items-center gap-1 mt-1",
                            isLead ? "justify-start" : "justify-end"
                          )}>
                            <span className="text-[10px] text-white/50">
                              {new Date(msg.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {!isLead && (
                              msg.status === "sent" ? <CheckCheck className="w-3 h-3 text-white/50" /> :
                              msg.status === "failed" ? <AlertCircle className="w-3 h-3 text-red-300" /> :
                              <Clock className="w-3 h-3 text-white/50" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/5 bg-[#111118]">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                      rows={1}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#4F6EF7]/50 resize-none min-h-[40px] max-h-[120px]"
                      style={{ height: "auto" }}
                      onInput={(e) => {
                        const target = e.currentTarget;
                        target.style.height = "auto";
                        target.style.height = Math.min(target.scrollHeight, 120) + "px";
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !inputText.trim()}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#6B8AFF] text-white hover:opacity-90 transition-all disabled:opacity-40 shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 px-1">
                  Messages sent via WhatsApp. Lead may receive SMS fallback if WhatsApp is unavailable.
                </p>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">Select a conversation</h3>
                <p className="text-sm text-gray-500">Choose a lead from the list to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

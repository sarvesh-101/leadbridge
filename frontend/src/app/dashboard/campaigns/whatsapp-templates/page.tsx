"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Phone, Bell, Calendar,
  AlertTriangle, TrendingUp, Zap, Clock, CheckCircle2,
  ChevronRight, Edit3, Eye, X, Loader2,
} from "lucide-react";

const TEMPLATES = [
  {
    id: "booking_confirmation_customer",
    category: "Customer",
    icon: Calendar,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Booking Confirmation (Customer)",
    description: "Sent to customer after a visit is booked",
    preview: (data: any) => [
      `Namaste ${data.customerName || "{{customerName}}"}!`,
      ``,
      `Aapki property visit confirm ho gayi hai.`,
      ``,
      `Property: ${data.propertyName || "{{propertyName}}"}`,
      `Address: ${data.propertyAddress || "{{propertyAddress}}"}`,
      `Date: ${data.visitDate || "{{visitDate}}"}`,
      `Time: ${data.visitTime || "{{visitTime}}"}`,
      ``,
      `${data.brokerName || "{{brokerName}}"} aapse milenge. Unka number: ${data.brokerPhone || "{{brokerPhone}}"}`,
      ``,
      `Koi sawaal ho toh is number pe WhatsApp karein.`,
      ``,
      `— ${data.businessName || "{{businessName}}"}`,
    ].join("\n"),
    variables: ["customerName", "propertyName", "propertyAddress", "visitDate", "visitTime", "brokerName", "brokerPhone", "businessName"],
  },
  {
    id: "booking_confirmed_owner",
    category: "Owner",
    icon: Bell,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Booking Alert (Owner)",
    description: "Alert sent to broker when a new booking is made",
    preview: (data: any) => [
      `🔔 New Booking Alert`,
      ``,
      `Lead: ${data.leadName || "{{leadName}}"} (${data.leadPhone || "{{leadPhone}}"})`,
      `Source: ${data.source || "{{source}}"}`,
      `Budget: ${data.budget || "{{budget}}"}`,
      `Looking for: ${data.bedrooms || "{{bedrooms}}"} ${data.propertyType || "{{propertyType}}"} in ${data.location || "{{location}}"}`,
      `Timeline: ${data.timeline || "{{timeline}}"}`,
      ``,
      `Visit booked: ${data.visitDate || "{{visitDate}}"} at ${data.visitTime || "{{visitTime}}"}`,
      ``,
      `View full details: ${data.dashboardLink || "{{dashboardLink}}"}`,
    ].join("\n"),
    variables: ["leadName", "leadPhone", "source", "budget", "bedrooms", "propertyType", "location", "timeline", "visitDate", "visitTime", "dashboardLink"],
  },
  {
    id: "booking_reminder_customer",
    category: "Customer",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Visit Reminder (Customer)",
    description: "Sent to customer on the day of visit",
    preview: (data: any) => [
      `Namaste ${data.customerName || "{{customerName}}"}!`,
      ``,
      `Aaj aapki property visit hai.`,
      ``,
      `Time: ${data.visitTime || "{{visitTime}}"}`,
      `Address: ${data.propertyAddress || "{{propertyAddress}}"}`,
      ``,
      `${data.brokerName || "{{brokerName}}"} aapka intezaar kar rahe hain.`,
      ``,
      `— ${data.businessName || "{{businessName}}"}`,
    ].join("\n"),
    variables: ["customerName", "visitTime", "propertyAddress", "brokerName", "businessName"],
  },
  {
    id: "noshow_alert",
    category: "Owner",
    icon: AlertTriangle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    title: "No-Show Alert (Owner)",
    description: "Alert when customer doesn't show up",
    preview: (data: any) => [
      `⚠️ No-Show Alert`,
      ``,
      `${data.leadName || "{{leadName}}"} did not show up for their visit.`,
      ``,
      `We are starting a 3-day follow-up sequence automatically:`,
      `• Day 1: AI call this afternoon`,
      `• Day 2: WhatsApp tomorrow`,
      `• Day 3: Final AI call`,
      ``,
      `View lead: ${data.dashboardLink || "{{dashboardLink}}"}`,
    ].join("\n"),
    variables: ["leadName", "dashboardLink"],
  },
  {
    id: "followup_d2_customer",
    category: "Customer",
    icon: MessageSquare,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Day 2 Follow-Up (Customer)",
    description: "WhatsApp follow-up after no-show (Day 2)",
    preview: (data: any) => [
      `Namaste,`,
      ``,
      `Hum samajhte hain aap kal nahi aa paaye.`,
      ``,
      `Kya aap abhi bhi ${data.location || "{{location}}"} mein property dekhne mein interested hain?`,
      ``,
      `Iss weekend ke liye aapke liye special slots available hain.`,
      ``,
      `Interested hain? Bas reply karein aur hum arrange kar dete hain.`,
      ``,
      `— ${data.businessName || "{{businessName}}"}`,
    ].join("\n"),
    variables: ["location", "businessName"],
  },
  {
    id: "cold_lead_owner",
    category: "Owner",
    icon: X,
    color: "text-gray-400",
    bg: "bg-gray-500/10",
    title: "Lead Marked Cold (Owner)",
    description: "Notification when a lead goes cold after 3 follow-ups",
    preview: (data: any) => [
      `❄️ Lead Marked Cold`,
      ``,
      `${data.leadName || "{{leadName}}"} (${data.leadPhone || "{{leadPhone}}"}) did not respond after 3 follow-up attempts.`,
      ``,
      `Source: ${data.source || "{{source}}"}`,
      `Budget: ${data.budget || "{{budget}}"}`,
      ``,
      `No further follow-ups will be sent.`,
      ``,
      `View history: ${data.dashboardLink || "{{dashboardLink}}"}`,
    ].join("\n"),
    variables: ["leadName", "leadPhone", "source", "budget", "dashboardLink"],
  },
  {
    id: "conversion_owner",
    category: "Owner",
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    title: "Deal Won (Owner)",
    description: "Celebration notification when a lead converts",
    preview: (data: any) => [
      `🎉 Deal Won!`,
      ``,
      `Congratulations! ${data.leadName || "{{leadName}}"} has been marked as converted.`,
      ...(data.dealAmount ? [`Deal amount: ${data.dealAmount}`] : []),
      ``,
      `View details: ${data.dashboardLink || "{{dashboardLink}}"}`,
    ].join("\n"),
    variables: ["leadName", "dealAmount", "dashboardLink"],
  },
  {
    id: "followup_result_owner",
    category: "Owner",
    icon: CheckCircle2,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    title: "Follow-up Result (Owner)",
    description: "Update after each follow-up attempt (D1/D2/D3)",
    preview: (data: any) => [
      `🔁 Follow-up ${data.day || "{{day}}"} Result`,
      ``,
      `${data.leadName || "{{leadName}}"}: ${data.result || "{{result}}"}`,
      ``,
      `View lead: ${data.dashboardLink || "{{dashboardLink}}"}`,
    ].join("\n"),
    variables: ["leadName", "day", "result", "dashboardLink"],
  },
];

const CATEGORIES = ["All", "Customer", "Owner"];

export default function WhatsAppTemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<Record<string, string>>({});

  const filtered = activeCategory === "All"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  function openPreview(template: typeof TEMPLATES[0]) {
    const data: Record<string, string> = {};
    template.variables.forEach(v => {
      data[v] = v === "businessName" || v === "brokerName" ? "LeadBridge" :
                v === "customerName" || v === "leadName" ? "Rajesh Sharma" :
                v === "visitDate" ? "15 July 2026" :
                v === "visitTime" ? "11:00 AM" :
                v === "propertyName" ? "Luxury 3BHK Apartment" :
                v === "propertyAddress" ? "Andheri West, Mumbai" :
                v === "brokerPhone" ? "+91 98765 43210" :
                v === "leadPhone" ? "+91 98765 43211" :
                v === "source" ? "99acres" :
                v === "budget" ? "₹80,00,000" :
                v === "bedrooms" ? "3 BHK" :
                v === "propertyType" ? "Apartment" :
                v === "location" ? "Andheri West" :
                v === "timeline" ? "Within 1 month" :
                v === "dashboardLink" ? "https://leadbridge.com/dashboard" :
                v === "dealAmount" ? "₹75,00,000" :
                v === "day" ? "1" :
                v === "result" ? "Call answered — no response to booking offer" :
                v === "mapsLink" ? "https://maps.google.com" :
                `{{${v}}}`;
    });
    setSampleData(data);
    setPreviewing(template.id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">WhatsApp Templates</h1>
        <p className="text-gray-400 mt-1">Preview all automated WhatsApp notification templates</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all",
              activeCategory === cat
                ? "bg-[#4F6EF7]/10 text-[#4F6EF7] border border-[#4F6EF7]/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((template) => {
          const Icon = template.icon;
          return (
            <motion.div key={template.id} layout
              className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
              onClick={() => openPreview(template)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", template.bg)}>
                  <Icon className={cn("w-5 h-5", template.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{template.title}</p>
                  <p className="text-xs text-gray-500">{template.category}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2 mb-3">{template.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">{template.variables.length} variables</span>
                <div className="flex items-center gap-1 text-xs text-[#4F6EF7] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewing(null)}
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[#111118] border border-[#2A2A3A] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const template = TEMPLATES.find(t => t.id === previewing);
              if (!template) return null;
              const Icon = template.icon;
              const message = template.preview(sampleData);

              return (
                <>
                  <div className="p-6 border-b border-[#2A2A3A]">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", template.bg)}>
                          <Icon className={cn("w-5 h-5", template.color)} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{template.title}</h3>
                          <p className="text-xs text-gray-500">{template.description}</p>
                        </div>
                      </div>
                      <button onClick={() => setPreviewing(null)} className="text-gray-500 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {template.variables.map(v => (
                        <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1A24] text-[#4F6EF7] border border-[#4F6EF7]/20 font-mono">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* Phone preview */}
                    <div className="max-w-sm mx-auto">
                      <div className="rounded-2xl bg-[#0A0A0F] border border-[#2A2A3A] overflow-hidden">
                        <div className="p-3 border-b border-[#2A2A3A] flex items-center gap-3">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", template.bg)}>
                            <Icon className={cn("w-4 h-4", template.color)} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-white">LeadBridge</p>
                            <p className="text-[10px] text-gray-500">WhatsApp</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="bg-[#1A1A24] rounded-xl p-4 max-w-[90%]">
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

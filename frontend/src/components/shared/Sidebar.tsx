"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Phone, Calendar, BarChart3,
  Settings, CreditCard, MessageSquare, Globe, Link as LinkIcon,
  ChevronLeft, ChevronRight, Building2, LogOut, Zap,
  Activity, Webhook, UserPlus, Home, RadioTower, Star,
  FileText, IndianRupee, Bell, Search, CalendarDays, FileSpreadsheet,
  Send,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth.store";
import { Lock } from "lucide-react";
import { canAccessFeature } from "./FeatureGate";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
  requiredPlan?: string; // Plan required to access this feature
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Leads", href: "/dashboard/leads", icon: <Users className="w-5 h-5" /> },
  { label: "Pipeline", href: "/dashboard/leads/pipeline", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Calls", href: "/dashboard/calls", icon: <Phone className="w-5 h-5" /> },
  { label: "Voice AI", href: "/dashboard/voice", icon: <RadioTower className="w-5 h-5" />, requiredPlan: "GROWTH" },
  { label: "Bookings", href: "/dashboard/bookings", icon: <Calendar className="w-5 h-5" /> },
  { label: "Properties", href: "/dashboard/properties", icon: <Home className="w-5 h-5" /> },
  { label: "Messages", href: "/dashboard/messages", icon: <MessageSquare className="w-5 h-5" /> },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: <Zap className="w-5 h-5" />, requiredPlan: "PRO" },
  { label: "WA Templates", href: "/dashboard/campaigns/whatsapp-templates", icon: <MessageSquare className="w-5 h-5" />, requiredPlan: "PRO" },
  { label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  { label: "Territories", href: "/dashboard/territories", icon: <Globe className="w-5 h-5" />, requiredPlan: "GROWTH" },
  { label: "Documents", href: "/dashboard/documents", icon: <FileText className="w-5 h-5" /> },
  { label: "Payment Links", href: "/dashboard/payment-links", icon: <IndianRupee className="w-5 h-5" /> },
  { label: "Calendar Sync", href: "/dashboard/calendar-sync", icon: <CalendarDays className="w-5 h-5" /> },
  { label: "Sheets Sync", href: "/dashboard/sheets-sync", icon: <FileSpreadsheet className="w-5 h-5" /> },
  { label: "Lead Forwarding", href: "/dashboard/forwarding", icon: <Send className="w-5 h-5" /> },
  { label: "Transcript Search", href: "/dashboard/transcript-search", icon: <Search className="w-5 h-5" /> },
  { label: "Notif. Preferences", href: "/dashboard/notification-preferences", icon: <Bell className="w-5 h-5" /> },
  { label: "Integrations", href: "/dashboard/integrations", icon: <LinkIcon className="w-5 h-5" /> },
  { label: "Referrals", href: "/dashboard/referrals", icon: <Star className="w-5 h-5" /> },
  { label: "Team", href: "/dashboard/team", icon: <UserPlus className="w-5 h-5" />, requiredPlan: "GROWTH" },
  { label: "Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" /> },
  { label: "Billing", href: "/dashboard/billing", icon: <CreditCard className="w-5 h-5" /> },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Clients", href: "/admin/clients", icon: <Building2 className="w-5 h-5" /> },
  { label: "Territories", href: "/admin/territories", icon: <Globe className="w-5 h-5" /> },
  { label: "Integration Health", href: "/admin/health", icon: <Activity className="w-5 h-5" /> },
  { label: "Forwarding", href: "/admin/forwarding", icon: <Send className="w-5 h-5" /> },
  { label: "Queues", href: "/admin/queues", icon: <Activity className="w-5 h-5" /> },
  { label: "Webhooks", href: "/admin/webhooks", icon: <Webhook className="w-5 h-5" /> },
  { label: "WhatsApp", href: "/admin/whatsapp", icon: <MessageSquare className="w-5 h-5" /> },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const items = isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS;
  const planBadge = user?.plan || "TRIAL";
  const currentPlan = planBadge;

  return (
    <motion.aside
      animate={{ width: isOpen ? 240 : 64 }}
      className="h-screen bg-[#101713]/85 backdrop-blur-xl border-r border-white/10 flex flex-col overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/10">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center shadow-[0_0_16px_rgba(52,211,153,0.35)]">
                <Zap className="w-4 h-4 text-[#0A0F0C]" />
              </div>
              <span className="text-[16px] font-display font-bold text-[#F0F7F3]">LeadBridge</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
        >
          {isOpen ? (
            <ChevronLeft className="w-4 h-4 text-[#9FB0A6]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#9FB0A6]" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const isLocked = item.requiredPlan ? !canAccessFeature(currentPlan, item.requiredPlan) : false;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 relative",
                isActive
                  ? "bg-[#34D399]/15 text-[#6FE3B0] shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25),0_0_16px_-4px_rgba(52,211,153,0.3)]"
                  : isLocked
                  ? "text-[#9FB0A6] cursor-not-allowed"
                  : "text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3]"
              )}
              onClick={(e) => isLocked ? e.preventDefault() : undefined}
              title={isLocked ? `Requires ${item.requiredPlan} plan` : item.label}
            >
              <span className="shrink-0 relative">
                {item.icon}
                {isLocked && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#24332C] flex items-center justify-center">
                    <Lock className="w-2.5 h-2.5 text-[#9FB0A6]" />
                  </span>
                )}
              </span>
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className={cn("truncate", isLocked && "opacity-50")}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isLocked && isOpen && (
                <span className="ml-auto text-[10px] uppercase tracking-wider text-[#9FB0A6]">
                  {item.requiredPlan}
                </span>
              )}
              {item.badge && isOpen && (
                <span className="ml-auto bg-[#FB7185] text-white text-[11px] rounded-full px-1.5 py-0.5">
                  {item.badge}
                </span>
              )}
              {/* Active left border */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[#34D399] rounded-r-full shadow-[0_0_8px_#34D399]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User section */}
      <div className="border-t border-white/10 p-3">
        {isOpen ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(52,211,153,0.3)]">
                <span className="text-[#0A0F0C] text-[13px] font-bold">
                  {(user?.name || user?.businessName || "U")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#F0F7F3] truncate">
                  {user?.businessName || user?.name || "User"}
                </p>
                <span className={cn(
                  "text-[11px] font-medium",
                  planBadge === "PRO" ? "text-[#E8C468]" :
                  planBadge === "GROWTH" ? "text-[#6FE3B0]" : "text-[#9FB0A6]"
                )}>
                  {planBadge}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] text-[#9FB0A6] hover:text-[#FB7185] hover:bg-white/[0.06] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="flex items-center justify-center w-full p-2 rounded-lg text-[#9FB0A6] hover:text-[#FB7185] hover:bg-white/[0.06] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Admin switch to broker view */}
      {isAdmin && isOpen && (
        <div className="px-4 py-2 border-t border-white/10">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[12px] text-[#9FB0A6] hover:text-[#F0F7F3] transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Switch to Broker View
          </Link>
        </div>
      )}
    </motion.aside>
  );
}

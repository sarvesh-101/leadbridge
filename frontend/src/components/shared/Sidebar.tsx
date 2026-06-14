"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Phone, Calendar, BarChart3,
  Settings, CreditCard, MessageSquare, Globe,
  ChevronLeft, ChevronRight, Building2, LogOut, Zap,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/auth.store";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Leads", href: "/dashboard/leads", icon: <Users className="w-5 h-5" /> },
  { label: "Calls", href: "/dashboard/calls", icon: <Phone className="w-5 h-5" /> },
  { label: "Bookings", href: "/dashboard/bookings", icon: <Calendar className="w-5 h-5" /> },
  { label: "Messages", href: "/dashboard/messages", icon: <MessageSquare className="w-5 h-5" /> },
  { label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  { label: "Territories", href: "/dashboard/territories", icon: <Globe className="w-5 h-5" /> },
  { label: "Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" /> },
  { label: "Billing", href: "/dashboard/billing", icon: <CreditCard className="w-5 h-5" /> },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: "Clients", href: "/admin/clients", icon: <Building2 className="w-5 h-5" /> },
  { label: "Territories", href: "/admin/territories", icon: <Globe className="w-5 h-5" /> },
  { label: "Calls", href: "/admin/calls", icon: <Phone className="w-5 h-5" /> },
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

  return (
    <motion.aside
      animate={{ width: isOpen ? 240 : 64 }}
      className="h-screen bg-[#111118] border-r border-[#2A2A3A] flex flex-col overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#2A2A3A]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-[#4F6EF7] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-[16px] font-display font-bold text-[#F0F0F8]">LeadBridge</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#22D3A5] animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-[#1A1A24] transition-colors"
        >
          {isOpen ? (
            <ChevronLeft className="w-4 h-4 text-[#6B6B8A]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#6B6B8A]" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 relative",
                isActive
                  ? "bg-[#4F6EF7]/10 text-[#4F6EF7]"
                  : "text-[#6B6B8A] hover:bg-[#1A1A24] hover:text-[#F0F0F8]"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <AnimatePresence>
                {isOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {item.badge && isOpen && (
                <span className="ml-auto bg-[#F43F5E] text-white text-[11px] rounded-full px-1.5 py-0.5">
                  {item.badge}
                </span>
              )}
              {/* Active left border */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[#4F6EF7] rounded-r-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User section */}
      <div className="border-t border-[#2A2A3A] p-3">
        {isOpen ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4F6EF7] to-[#4F6EF7]/60 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[13px] font-semibold">
                  {(user?.name || user?.businessName || "U")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#F0F0F8] truncate">
                  {user?.businessName || user?.name || "User"}
                </p>
                <span className={cn(
                  "text-[11px] font-medium",
                  planBadge === "PRO" ? "text-[#C9A84C]" :
                  planBadge === "GROWTH" ? "text-[#4F6EF7]" : "text-[#6B6B8A]"
                )}>
                  {planBadge}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] text-[#6B6B8A] hover:text-[#F43F5E] hover:bg-[#1A1A24] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="flex items-center justify-center w-full p-2 rounded-lg text-[#6B6B8A] hover:text-[#F43F5E] hover:bg-[#1A1A24] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Admin switch to broker view */}
      {isAdmin && isOpen && (
        <div className="px-4 py-2 border-t border-[#2A2A3A]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[12px] text-[#6B6B8A] hover:text-[#F0F0F8] transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Switch to Broker View
          </Link>
        </div>
      )}
    </motion.aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "../../components/shared/Sidebar";
import { TopBar } from "../../components/shared/TopBar";
import { ErrorBoundary } from "../../components/shared/ErrorBoundary";
import SystemStatus from "../../components/shared/SystemStatus";
import { useUIStore } from "../../stores/ui.store";
import { wsClient } from "../../lib/websocket";
import { useAuthStore } from "../../stores/auth.store";
import { api } from "../../lib/api";
import { Loader2, Menu, X } from "lucide-react";
import { Toaster } from "sonner";
import { initPWA } from "../../lib/pwa";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const [setupCheckDone, setSetupCheckDone] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Load user profile data once and always show the dashboard
    if (isAuthenticated && !pathname.startsWith("/setup") && !pathname.startsWith("/auth")) {
      api.get("/me")
        .then(() => {
          setSetupCheckDone(true);
        })
        .catch(() => {
          // If /me fails, still render dashboard (likely network issue)
          setSetupCheckDone(true);
        });
    } else {
      setSetupCheckDone(true);
    }
  }, [isAuthenticated, pathname]);

  useEffect(() => {
    if (isAuthenticated && setupCheckDone) {
      wsClient.connect();
      initPWA();
    }
    return () => {
      wsClient.disconnect();
    };
  }, [isAuthenticated, setupCheckDone]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Show loading spinner briefly while checking profile on dashboard routes
  if (!setupCheckDone && isAuthenticated && !pathname.startsWith("/setup") && !pathname.startsWith("/auth")) {
    return (
      <div className="h-screen bg-[#0B0D12] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0B0D12]">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <MobileSidebarOverlay onClose={() => setMobileMenuOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0B0D12] pb-20 md:pb-6">
          <div className="max-w-7xl mx-auto space-y-4">
            <SystemStatus />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />

      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1B1E26",
            border: "1px solid #272B34",
            color: "#F2F4F8",
          },
        }}
      />
    </div>
  );
}

/* ─── Mobile Sidebar Overlay ─────────────────────────────────── */

function MobileSidebarOverlay({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  const isAdmin = useAuthStore((s) => s.user?.role === "admin");

  const NAV_ITEMS = [
    { label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { label: "Leads", href: "/dashboard/leads", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { label: "Pipeline", href: "/dashboard/leads/pipeline", icon: "M4 6h16M4 10h16M4 14h16M4 18h16" },
    { label: "Calls", href: "/dashboard/calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    { label: "Voice AI", href: "/dashboard/voice", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
    { label: "Bookings", href: "/dashboard/bookings", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { label: "Properties", href: "/dashboard/properties", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { label: "Messages", href: "/dashboard/messages", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
    { label: "Campaigns", href: "/dashboard/campaigns", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { label: "Analytics", href: "/dashboard/analytics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { label: "Territories", href: "/dashboard/territories", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" },
    { label: "Integrations", href: "/dashboard/integrations", icon: "M4 5a1 1 0 014 0v2a1 1 0 01-4 0V5zm10 0a1 1 0 014 0v2a1 1 0 01-4 0V5zM4 13a1 1 0 014 0v2a1 1 0 01-4 0v-2zm10 0a1 1 0 014 0v2a1 1 0 01-4 0v-2zM7 7h10v10H7V7z" },
    { label: "Referrals", href: "/dashboard/referrals", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
    { label: "Team", href: "/dashboard/team", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { label: "Settings", href: "/dashboard/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    { label: "Billing", href: "/dashboard/billing", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  ];

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-72 bg-[#14161C] border-r border-[#272B34] overflow-y-auto z-50 shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-[#272B34]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#3B82F6] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-[16px] font-bold text-[#F2F4F8]">LeadBridge</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#1B1E26] text-[#8B93A3] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                    : "text-[#8B93A3] hover:bg-[#1B1E26] hover:text-[#F2F4F8]"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d={item.icon} />
                </svg>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/* ─── Mobile Bottom Nav ──────────────────────────────────────── */

function MobileBottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { label: "Leads", href: "/dashboard/leads", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { label: "Calls", href: "/dashboard/calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    { label: "Bookings", href: "/dashboard/bookings", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#14161C] border-t border-[#272B34] flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              active ? "text-[#3B82F6]" : "text-[#8B93A3]"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-[#8B93A3] transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
}

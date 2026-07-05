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
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { initPWA } from "../../lib/pwa";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const [setupCheckDone, setSetupCheckDone] = useState(false);

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

  // Show loading spinner briefly while checking profile on dashboard routes
  if (!setupCheckDone && isAuthenticated && !pathname.startsWith("/setup") && !pathname.startsWith("/auth")) {
    return (
      <div className="h-screen bg-[#0A0A0F] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#4F6EF7] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0A0A0F]">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-[#0A0A0F]">
          <div className="max-w-7xl mx-auto space-y-4">
            <SystemStatus />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />

      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1A1A24",
            border: "1px solid #2A2A3A",
            color: "#F0F0F8",
          },
        }}
      />
    </div>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { label: "Leads", href: "/dashboard/leads", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
    { label: "Calls", href: "/dashboard/calls", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    { label: "Bookings", href: "/dashboard/bookings", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { label: "More", href: "#", icon: "M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#111118] border-t border-[#2A2A3A] flex items-center justify-around px-2 z-50">
      {navItems.map((item) => {
        const active = item.href !== "#" && isActive(item.href);
        const content = (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon} />
            </svg>
            <span className="text-[10px] font-medium">{item.label}</span>
          </>
        );
        if (item.href === "#") {
          return (
            <button key={item.label} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors text-[#6B6B8A]`}>
              {content}
            </button>
          );
        }
        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              active ? "text-[#4F6EF7]" : "text-[#6B6B8A]"
            }`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

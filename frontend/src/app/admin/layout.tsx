"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/shared/Sidebar";
import { TopBar } from "../../components/shared/TopBar";
import { ErrorBoundary } from "../../components/shared/ErrorBoundary";
import { useUIStore } from "../../stores/ui.store";
import { useAuthStore } from "../../stores/auth.store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/auth/login");
    }
    if (mounted && isAuthenticated && user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || !isAuthenticated || user?.role !== "admin") {
    return (
      <div className="h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-leadflow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0A0A0F] overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 bg-[#0A0A0F]">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Toaster } from "sonner";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function OfflineDetector() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-50 bg-red-500/90 backdrop-blur-md border-b border-red-400/30">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4 text-white" />
        <span className="text-xs text-white font-medium">
          You&apos;re offline. Some features may be unavailable.
        </span>
      </div>
    </div>
  );
}

function OnlineBanner() {
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
      setWasOffline(false);
    };
    const handleOffline = () => setWasOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  if (!showReconnected) return null;

  return (
    <div className="sticky top-0 z-50 bg-green-500/90 backdrop-blur-md border-b border-green-400/30 animate-in slide-in-from-top">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
        <Wifi className="w-4 h-4 text-white" />
        <span className="text-xs text-white font-medium">
          Back online! Your data is up to date.
        </span>
      </div>
    </div>
  );
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OfflineDetector />
      <OnlineBanner />
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      <Toaster
        position="top-center"
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
    </>
  );
}

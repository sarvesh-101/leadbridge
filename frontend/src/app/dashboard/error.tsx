"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  const isAuthError =
    error.message?.toLowerCase().includes("401") ||
    error.message?.toLowerCase().includes("unauthorized") ||
    error.message?.toLowerCase().includes("session expired");

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-[#F0F7F3] mb-2">
          {isAuthError ? "Session Expired" : "Something went wrong"}
        </h2>
        <p className="text-sm text-[#9FB0A6] mb-6">
          {isAuthError
            ? "Your session has expired. Please log in again."
            : "An unexpected error occurred. Please try again or contact support."}
        </p>

        {error.digest && (
          <p className="text-[10px] text-[#6B7C73] mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          {isAuthError && (
            <Link
              href="/auth/login"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-[#9FB0A6] text-sm font-medium hover:bg-white/[0.06] transition-all"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

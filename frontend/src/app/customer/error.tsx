"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, LogIn } from "lucide-react";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CustomerPage Error]", error);
  }, [error]);

  const isAuthError = error.message?.toLowerCase().includes("401") ||
    error.message?.toLowerCase().includes("unauthorized") ||
    error.message?.toLowerCase().includes("session");

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {isAuthError ? "Session Expired" : "Something went wrong"}
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          {isAuthError
            ? "Your session has expired. Please log in again to continue."
            : "An unexpected error occurred. Please try again or contact support if the issue persists."}
        </p>

        {error.digest && (
          <p className="text-[10px] text-gray-600 mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          {isAuthError && (
            <a
              href="/customer/login"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#272B34] text-gray-300 text-sm font-medium hover:bg-[#1B1E26] transition-all"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

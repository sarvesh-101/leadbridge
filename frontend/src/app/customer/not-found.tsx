"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function CustomerNotFound() {
  return (
    <div className="min-h-screen bg-canvas aurora-backdrop flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-brand/20 mb-4">404</div>
        <h2 className="text-xl font-bold text-ink mb-2">Page Not Found</h2>
        <p className="text-sm text-ink-soft mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or return to your dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/customer/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-line-subtle text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <Link
            href="/customer/login"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line text-ink-soft text-sm font-medium hover:bg-white/[0.06] transition-all"
          >
            <Search className="w-4 h-4" />
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}

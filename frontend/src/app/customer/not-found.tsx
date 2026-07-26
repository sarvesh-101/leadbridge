"use client";

import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function CustomerNotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-[#4F6EF7]/20 mb-4">404</div>
        <h2 className="text-xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-sm text-gray-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or return to your dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/customer/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4F6EF7] text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <Link
            href="/customer/login"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#2A2A3A] text-gray-300 text-sm font-medium hover:bg-[#1A1A24] transition-all"
          >
            <Search className="w-4 h-4" />
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}

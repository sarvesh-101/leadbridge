"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0F0C] flex items-center justify-center relative overflow-hidden">
      {/* Aurora blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#34D399] opacity-[0.07] blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#1B4332] opacity-40 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative text-center px-4"
      >
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.4)]">
            <Zap className="w-5 h-5 text-[#0A0F0C]" />
          </div>
          <span className="text-[20px] font-display font-bold text-[#F0F7F3] tracking-[-0.02em]">LeadBridge</span>
        </div>

        <div className="mb-6">
          <span className="text-[80px] sm:text-[120px] font-display font-bold text-gradient-emerald leading-none">404</span>
        </div>

        <h1 className="text-[24px] font-display font-bold text-[#F0F7F3] mb-3">Page not found</h1>
        <p className="text-[14px] text-[#9FB0A6] mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-[13px] font-bold transition-all duration-150 hover:shadow-[0_0_32px_rgba(52,211,153,0.4)] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.06] border border-white/15 text-[#F0F7F3] text-[13px] font-semibold hover:border-[#34D399]/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}

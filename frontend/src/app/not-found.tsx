"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center relative overflow-hidden">
      {/* Aurora blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand opacity-[0.05] blur-[140px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-line-subtle opacity-40 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative text-center px-4"
      >
        <div className="inline-flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-line-subtle flex items-center justify-center shadow-[0_0_20px_rgba(242,140,69,0.25)]">
            <Zap className="w-5 h-5 text-canvas" />
          </div>
          <span className="text-[20px] font-display font-bold text-ink tracking-[-0.02em]">Converza</span>
        </div>

        <div className="mb-6">            <span className="text-[80px] sm:text-[120px] font-display font-bold text-ink leading-none" style={{ letterSpacing: '-0.04em' }}>404</span>
        </div>

        <h1 className="text-[24px] font-display font-bold text-ink mb-3">Page not found</h1>
        <p className="text-[14px] text-ink-soft mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand to-brand-soft text-canvas text-[13px] font-bold transition-all duration-150 hover:shadow-[0_0_32px_rgba(242,140,69,0.25)] active:scale-[0.98]"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/[0.06] border border-line text-ink text-[13px] font-semibold hover:border-brand/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}

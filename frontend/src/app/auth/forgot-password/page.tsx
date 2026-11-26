"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Mail, ArrowRight, Zap, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post("/auth/forgot-password", { email }, { skipAuth: true });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand opacity-[0.07] blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-line-subtle opacity-40 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-line-subtle flex items-center justify-center shadow-[0_0_20px_rgba(242,140,69,0.25)]">
              <Zap className="w-5 h-5 text-canvas" />
            </div>
            <span className="text-xl font-bold text-ink">Converza</span>
          </Link>
          <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
          <p className="text-ink-soft mt-2">
            {sent
              ? "Check your email for the reset link"
              : "Enter your email and we&apos;ll send you a reset link"}
          </p>
        </div>

        <div className="p-8 rounded-2xl glass-card">
          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/25 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(242,140,69,0.22)]">
                <CheckCircle className="w-8 h-8 text-brand" />
              </div>
              <p className="text-ink-soft text-sm leading-relaxed">
                If an account with <span className="text-ink font-medium">{email}</span> exists,
                a password reset link has been sent. Please check your inbox and follow the
                instructions.
              </p>
              <p className="text-ink-muted text-xs">
                Didn&apos;t receive it? Check your spam folder or try again.
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-brand hover:underline font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </motion.div>
          ) : (
            <>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/25 text-danger text-sm mb-4"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-ink-soft mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.05] border border-line text-ink placeholder-ink-muted focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30 transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas font-bold transition-all duration-300 hover:shadow-[0_0_32px_rgba(242,140,69,0.35)],",
                    loading ? "opacity-70 cursor-not-allowed" : ""
                  )}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-canvas/30 border-t-[var(--bg-primary)] rounded-full animate-spin" />
                  ) : (
                    <>Send Reset Link <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to login
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, ArrowRight, Zap, AlertCircle, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (success) {
      redirectTimer.current = setTimeout(() => router.push("/auth/login"), 3000);
    }
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [success, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post("/auth/reset-password", { token, password }, { skipAuth: true });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/25 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-ink mb-2">Invalid reset link</h2>
        <p className="text-ink-soft text-sm mb-6">
          This reset link is missing or invalid. Please request a new one.
        </p>
        <Link
          href="/auth/forgot-password"
          className="text-brand hover:underline font-medium text-sm"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6 space-y-4"
      >            <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/25 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(242,140,69,0.22)]">
          <CheckCircle className="w-8 h-8 text-brand" />
        </div>
        <h2 className="text-lg font-semibold text-ink">Password reset successful!</h2>
        <p className="text-ink-soft text-sm">
          Redirecting you to login...
        </p>
      </motion.div>
    );
  }

  const strengthChecks = [
    { label: "At least 8 characters", pass: password.length >= 8 },
    { label: "Contains a number", pass: /\d/.test(password) },
    { label: "Contains a letter", pass: /[a-zA-Z]/.test(password) },
  ];

  const strength = strengthChecks.filter((c) => c.pass).length;

  return (
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
          <label htmlFor="new-password" className="block text-sm font-medium text-ink-soft mb-2">
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              id="new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full pl-10 pr-12 py-3 rounded-xl bg-white/[0.05] border border-line text-ink placeholder-ink-muted focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/30 transition-all"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-soft"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password strength indicator */}
          {password.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-all duration-300",
                      strength >= level
                        ? level === 1
                          ? "bg-danger"
                          : level === 2
                          ? "bg-warning"
                          : "bg-brand"
                        : "bg-white/10"
                    )}
                  />
                ))}
              </div>
              <ul className="space-y-1">
                {strengthChecks.map((check) => (
                  <li
                    key={check.label}
                    className={cn(
                      "text-xs flex items-center gap-1.5 transition-colors",                      check.pass ? "text-brand" : "text-ink-muted"
                    )}>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      check.pass ? "bg-brand" : "bg-ink-muted"
                    )} />
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || password.length < 8}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas font-bold transition-all duration-300 hover:shadow-[0_0_32px_rgba(242,140,69,0.35)],",
            (loading || password.length < 8) ? "opacity-70 cursor-not-allowed" : ""
          )}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-canvas/30 border-t-[var(--bg-primary)] rounded-full animate-spin" />
          ) : (
            <>Reset Password <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center relative overflow-hidden">        <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand opacity-[0.05] blur-[140px]" />
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
          <h1 className="text-2xl font-bold text-ink">Set new password</h1>
          <p className="text-ink-soft mt-2">Enter your new password below</p>
        </div>

        <div className="p-8 rounded-2xl glass-card overflow-hidden">
          <Suspense fallback={
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-canvas/30 border-t-[var(--bg-primary)] rounded-full animate-spin" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-brand hover:underline font-medium"
            >
              Back to login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

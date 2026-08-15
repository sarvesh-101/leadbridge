"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Mail, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";

/**
 * FIX Round-2 #3: email verification landing page.
 * Reads ?token= from the email link, calls GET /auth/verify-email, and on
 * success logs the broker in and redirects to the dashboard.
 */
function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string>("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setError("Missing verification token. Use the link from your email.");
      return;
    }

    api
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`, { skipAuth: true })
      .then((res) => {
        login({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
        setStatus("success");
        setTimeout(() => router.push("/dashboard"), 1200);
      })
      .catch((err: any) => {
        setStatus("error");
        setError(err?.message || "Verification failed. The link may be invalid or expired.");
      });
  }, [searchParams, login, router]);

  return (
    <div className="min-h-screen bg-[#0B0D12] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#3B82F6] opacity-[0.03] blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#3B82F6] opacity-[0.03] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md mx-4"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-[20px] font-display font-bold text-[#F2F4F8] tracking-[-0.02em]">LeadBridge</span>
          </Link>
        </div>

        <div className="p-6 rounded-lg bg-[#14161C] border border-[#272B34]">
          {status === "loading" && (
            <div className="text-center py-6">
              <Loader2 className="w-8 h-8 mx-auto mb-4 text-[#3B82F6] animate-spin" />
              <p className="text-[14px] text-[#8B93A3]">Verifying your email…</p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 flex items-center justify-center">
                <Mail className="w-6 h-6 text-[#10B981]" />
              </div>
              <h2 className="text-[18px] font-display font-bold text-[#F2F4F8] mb-2">Email verified!</h2>
              <p className="text-[13px] text-[#8B93A3] mb-2">Taking you to your dashboard…</p>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#F43F5E]/10 border border-[#F43F5E]/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-[#F43F5E]" />
              </div>
              <h2 className="text-[18px] font-display font-bold text-[#F2F4F8] mb-2">Verification failed</h2>
              <p className="text-[13px] text-[#8B93A3] leading-relaxed mb-5">{error}</p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3B82F6] text-white text-[13px] font-semibold hover:brightness-110 transition-all"
              >
                Go to login <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}

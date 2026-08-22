"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, ArrowRight, Zap, Building2, Shield, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Role = "client" | "admin";

// Google OAuth Client ID from env (optional — only shows button if set)
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [role, setRole] = useState<Role>("client");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // FIX Round-2 #3: account exists but email not verified — show resend prompt
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendFailed, setResendFailed] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/google", { credential: response.credential }, { skipAuth: true });
      login({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });

      // Admin users go to admin dashboard, brokers go to main dashboard
      if (res.user?.role === "admin") {
        router.push("/dashboard/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Google Sign-In failed");
    } finally {
      setLoading(false);
    }
  }, [login, router]);

  // Initialize Google One Tap / Sign-In button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    // Load Google Identity Services library if not already loaded
    // Google Identity Services type augmentation
    const google = (window as Window & typeof globalThis & { google?: { accounts?: { id: { initialize: Function; renderButton: Function; prompt: Function } } } }).google;
    if (google?.accounts) {
      renderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogleButton;
    document.body.appendChild(script);

    function renderGoogleButton() {
      if (!googleBtnRef.current) return;
      google!.accounts!.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      google!.accounts!.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width: googleBtnRef.current.offsetWidth || 360,
        text: "signin_with",
        shape: "pill",
      });
    }
  }, [handleGoogleCredential]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = role === "admin" ? "/auth/admin/login" : "/auth/login";
      const res = await api.post(endpoint, { email, password }, { skipAuth: true });
      login({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });

      // Admin users go to admin dashboard, brokers go to main dashboard
      if (res.user?.role === "admin") {
        router.push("/dashboard/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
      // FIX Round-2 #3: server flags unverified accounts (403 + verificationRequired)
      if (err?.data?.verificationRequired) {
        setVerificationRequired(true);
        setResendSent(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResending(true);
    setResendSent(false);
    setResendFailed(false);
    try {
      const res = await api.post("/auth/resend-verification", { email }, { skipAuth: true });
      setResendSent(true);
      // FIX Round-2 #3 (reviewer): server tells us if SMTP actually sent it
      setResendFailed(res.emailSent === false);
    } catch (err: any) {
      setError(err.message || "Could not resend verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0F0C] flex items-center justify-center relative overflow-hidden">
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#34D399] opacity-[0.07] blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#1B4332] opacity-40 blur-[100px]" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-[#E8C468] opacity-[0.04] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.4)]">
              <Zap className="w-5 h-5 text-[#0A0F0C]" />
            </div>
            <span className="text-[20px] font-display font-bold text-[#F0F7F3] tracking-[-0.02em]">LeadBridge</span>
          </Link>
          <h1 className="text-[24px] font-display font-bold text-[#F0F7F3]">Welcome back</h1>
          <p className="text-[14px] text-[#9FB0A6] mt-2">Sign in to your account</p>
        </div>

        <div className="p-6 rounded-lg glass-card">
          {/* Role Toggle */}
          <div className="flex bg-white/[0.05] border border-white/10 rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => { setRole("client"); setError(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                role === "client"
                  ? "bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] font-semibold"
                  : "text-[#9FB0A6] hover:text-[#F0F7F3]"
              )}
            >
              <Building2 className="w-4 h-4" />
              Broker
            </button>
            <button
              type="button"
              onClick={() => { setRole("admin"); setError(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                role === "admin"
                  ? "bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] font-semibold"
                  : "text-[#9FB0A6] hover:text-[#F0F7F3]"
              )}
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && !verificationRequired && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-[#FB7185]/10 border border-[#FB7185]/25 text-[#FB7185] text-[13px]"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* FIX Round-2 #3: email verification prompt */}
            {verificationRequired && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-[#B45309]/10 border border-[#B45309]/30 text-[13px]"
              >
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#E8C468]" />
                  <div>
                    <p className="text-[#F0F7F3] font-medium mb-1">Verify your email</p>
                    <p className="text-[#9FB0A6] leading-relaxed mb-2">
                      Check <span className="text-[#F0F7F3]">{email || "your inbox"}</span> for the
                      verification link we sent when you signed up.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resending}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/15 text-[12px] font-semibold text-[#F0F7F3] hover:border-[#E8C468] transition-colors"
                      >
                        {resending ? "Sending…" : "Resend email"}
                      </button>
                      {resendSent && !resendFailed && (
                        <span className="text-[12px] text-[#34D399]">✓ Sent again</span>
                      )}
                      {resendFailed && (
                        <span className="text-[12px] text-[#E8C468]">Could not send — retry in a minute</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-[13px] font-medium text-[#9FB0A6] mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
                <input
                  id="login-email" name="email" type="email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-[13px] text-[#F0F7F3] placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60 focus:ring-1 focus:ring-[#34D399]/30 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-[13px] font-medium text-[#9FB0A6] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
                <input
                  id="login-password" name="password" type={showPassword ? "text" : "password"}
                  autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full pl-10 pr-12 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-[13px] text-[#F0F7F3] placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60 focus:ring-1 focus:ring-[#34D399]/30 transition-colors"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7C73] hover:text-[#9FB0A6]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link href="/auth/forgot-password" className="text-[12px] text-[#6FE3B0] hover:underline">Forgot password?</Link>
            </div>

            <button
              type="submit" disabled={loading}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-[13px] font-bold transition-all duration-150 hover:shadow-[0_0_32px_rgba(52,211,153,0.4)] active:scale-[0.98]",
                loading && "opacity-70 cursor-not-allowed"
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0A0F0C]/30 border-t-[#0A0F0C] rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            {/* Google Sign-In */}
            {GOOGLE_CLIENT_ID && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-[#101713] px-2 text-[#9FB0A6]">or continue with</span>
                  </div>
                </div>
                <div ref={googleBtnRef} className="flex justify-center" />
              </>
            )}
          </form>

          <div className="mt-5 text-center">
            {role === "client" ? (
              <p className="text-[13px] text-[#9FB0A6]">
                Don&apos;t have an account?{" "}
                <Link href="/auth/register" className="text-[#6FE3B0] hover:underline font-medium">Create one</Link>
              </p>
            ) : (
              <p className="text-[13px] text-[#9FB0A6]">Admin access is for platform staff only</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

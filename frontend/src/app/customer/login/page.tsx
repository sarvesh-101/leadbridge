"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Lock, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";

import { customerApi } from "@/lib/customer-api";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<"phone" | "otp" | "loading">("phone");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first OTP input
  useEffect(() => {
    if (step === "otp") {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  async function handleSendOTP() {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return toast.error("Please enter a valid 10-digit phone number");
    }

    setLoading(true);
    try {
      await customerApi.post("/customer/auth/send-otp", { phone: cleanPhone });

      setStep("otp");
      setCountdown(30);
      toast.success("OTP sent to your WhatsApp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      return toast.error("Please enter the complete 6-digit OTP");
    }

    setLoading(true);
    try {
      const data = await customerApi.post("/customer/auth/verify-otp", {
          phone: phone.replace(/\D/g, ""),
          otp: otpString,
        });

      // Store token + customer data in session storage (not persisted auth store)
      sessionStorage.setItem("customer_token", data.accessToken);
      sessionStorage.setItem("customer_data", JSON.stringify(data.customer));
      if (data.booking) {
        sessionStorage.setItem("customer_booking", JSON.stringify(data.booking));
      }

      toast.success("Welcome!");
      router.push("/customer/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) {
      // Paste handling — distribute characters
      const chars = value.split("").slice(0, 6);
      const newOtp = [...otp];
      chars.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + chars.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5 && newOtp.every((d) => d)) {
      setTimeout(() => handleVerifyOTP(), 300);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleVerifyOTP();
    }
  }

  return (
    <div className="min-h-screen bg-canvas aurora-backdrop flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-brand/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-line-subtle to-brand-deep flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-ink">Converza</span>
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">Track Your Visit</h1>
          <p className="text-sm text-ink-soft">Enter your phone number to view and manage your booking</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 rounded-2xl app-card"
            >
              <label className="text-xs text-ink-soft mb-2 block">Phone Number</label>
              <div className="relative mb-4">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 15))}
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                  placeholder="+91 98765 43210"
                  type="tel"
                  inputMode="numeric"
                  className="w-full pl-10 pr-4 py-3 rounded-xl app-card text-ink text-sm placeholder-ink-muted focus:outline-none focus:border-brand/50/50"
                />
              </div>
              <button
                onClick={handleSendOTP}
                disabled={loading || phone.replace(/\D/g, "").length < 10}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 transition-all disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Send OTP
              </button>
              <p className="text-[11px] text-ink-soft text-center mt-3">
                OTP will be sent via WhatsApp or SMS
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 rounded-2xl app-card"
            >
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => { setStep("phone"); setOtp(["", "", "", "", "", ""]); }}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-ink-soft"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <p className="text-sm text-ink font-medium">Enter OTP</p>
                  <p className="text-xs text-ink-soft">Sent to {phone.replace(/(\d{2})\d{6}(\d{2})/, "$1******$2")}</p>
                </div>
              </div>

              {/* OTP Input */}
              <div className="flex gap-2 justify-center mb-6">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-12 text-center rounded-xl app-card text-ink text-lg font-bold focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-line-subtle/30 transition-all"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyOTP}
                disabled={loading || otp.some((d) => !d)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-brand to-brand-soft text-canvas text-sm font-medium hover:opacity-90 transition-all disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Verify & Login
              </button>

              {/* Resend */}
              <div className="text-center mt-4">
                {countdown > 0 ? (
                  <span className="text-xs text-ink-soft">Resend in {countdown}s</span>
                ) : (
                  <button onClick={handleSendOTP} disabled={loading}
                    className="text-xs text-brand hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[11px] text-ink-soft mt-6">
          By continuing, you agree to receive OTP via WhatsApp or SMS
        </p>
      </motion.div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Zap, Building2, MapPin, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // FIX Round-2 #3: after register we show a "check your email" screen until
  // the broker verifies their email (login is blocked server-side until then).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  // FIX Round-2 #3 (reviewer): true when the server couldn't send the
  // verification email (SMTP not configured) — warn the broker.
  const [emailWarning, setEmailWarning] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    companyName: "", city: "", password: "",
  });
  // DPDP Phase 1.3: explicit consent to the Privacy Policy (required)
  const [consent, setConsent] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) errors.firstName = "First name is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) errors.email = "Email is required";
    else if (!emailRegex.test(formData.email)) errors.email = "Please enter a valid email";
    const phoneDigits = formData.phone.replace(/[\s\-()]/g, "");
    if (!formData.phone.trim()) errors.phone = "Phone is required";
    else if (phoneDigits.length < 10) errors.phone = "Enter a valid phone (min 10 digits)";
    if (!formData.companyName.trim()) errors.companyName = "Company is required";
    if (!formData.city.trim()) errors.city = "City is required";
    if (!formData.password) errors.password = "Password is required";
    else if (formData.password.length < 8) errors.password = "Min 8 characters";
    else if (!/[a-zA-Z]/.test(formData.password)) errors.password = "Must contain a letter";
    else if (!/\d/.test(formData.password)) errors.password = "Must contain a number";
    // DPDP Phase 1.3: consent is a hard requirement
    if (!consent) errors.consent = "You must accept the Privacy Policy to continue";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        email: formData.email, password: formData.password,
        businessName: formData.companyName,
        ownerName: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone, city: formData.city,
        consent: true,
      }, { skipAuth: true });
      // FIX Round-2 #3: new accounts need email verification before login
      if (res.requiresVerification) {
        // FIX Round-2 #3 (reviewer): if SMTP failed server-side (emailSent false),
        // show a warning so the broker doesn't wait for an email that never came.
        setEmailWarning(res.emailSent === false);
        setPendingEmail(formData.email);
        return;
      }
      login({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    setResendSent(false);
    try {
      const res = await api.post("/auth/resend-verification", { email: pendingEmail }, { skipAuth: true });
      // FIX Round-2 #3 (reviewer): server tells us if SMTP actually sent it
      setEmailWarning(res.emailSent === false);
      setResendSent(true);
    } catch (err: any) {
      setError(err.message || "Could not resend verification email");
    } finally {
      setResending(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const passwordChecks = [
    { label: "At least 8 characters", pass: formData.password.length >= 8 },
    { label: "Contains a number", pass: /\d/.test(formData.password) },
    { label: "Contains a letter", pass: /[a-zA-Z]/.test(formData.password) },
  ];
  const passwordStrength = passwordChecks.filter((c) => c.pass).length;

  return (
    <div className="min-h-screen bg-[#0A0F0C] flex items-center justify-center relative overflow-hidden py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#34D399] opacity-[0.07] blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#1B4332] opacity-40 blur-[100px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-lg mx-4">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.4)]">
              <Zap className="w-5 h-5 text-[#0A0F0C]" />
            </div>
            <span className="text-[20px] font-display font-bold text-[#F0F7F3] tracking-[-0.02em]">LeadBridge</span>
          </Link>
          <h1 className="text-[24px] font-display font-bold text-[#F0F7F3]">Create your account</h1>
          <p className="text-[14px] text-[#9FB0A6] mt-2">Start your 14-day free trial</p>
        </div>

        <div className="p-6 rounded-lg glass-card">
          {pendingEmail ? (
            /* FIX Round-2 #3: verification-required success screen */
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#34D399]/10 border border-[#34D399]/30 flex items-center justify-center">
                <Mail className="w-6 h-6 text-[#34D399]" />
              </div>
              <h2 className="text-[18px] font-display font-bold text-[#F0F7F3] mb-2">Check your email</h2>
              <p className="text-[13px] text-[#9FB0A6] leading-relaxed mb-1">
                We sent a verification link to{" "}
                <span className="text-[#F0F7F3] font-medium">{pendingEmail}</span>
              </p>
              <p className="text-[13px] text-[#9FB0A6] leading-relaxed mb-5">
                Click the link to activate your 14-day free trial and log in.
              </p>
              {emailWarning && (
                <p className="flex items-center gap-2 p-3 rounded-lg bg-[#E8C468]/10 border border-[#E8C468]/25 text-[#E8C468] text-[12px] text-left mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  The verification email could not be sent right now. Use the
                  resend button below to try again.
                </p>
              )}
              {resendSent && (
                <p className="text-[12px] text-[#34D399] mb-3">✓ Verification email sent again</p>
              )}
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={handleResend} disabled={resending}
                  className="px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/15 text-[13px] font-semibold text-[#F0F7F3] hover:border-[#34D399]/50 transition-colors">
                  {resending ? "Sending…" : "Resend email"}
                </button>
                <Link href="/auth/login"
                  className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-[13px] font-bold hover:shadow-[0_0_24px_rgba(52,211,153,0.4)] transition-all">
                  Go to login
                </Link>
              </div>
            </motion.div>
          ) : (
          <>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-[#FB7185]/10 border border-[#FB7185]/25 text-[#FB7185] text-[13px] mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" error={fieldErrors.firstName}>
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
                <input id="reg-firstname" value={formData.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  placeholder="John" required
                  className={inputClass(fieldErrors.firstName)} />
              </Field>
              <Field label="Last Name">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
                <input value={formData.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  placeholder="Doe" className={inputClass()} />
              </Field>
            </div>

            <Field label="Email" error={fieldErrors.email}>
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
              <input type="email" autoComplete="email" value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="you@company.com" required className={inputClass(fieldErrors.email)} />
            </Field>

            <Field label="Phone" error={fieldErrors.phone}>
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
              <input type="tel" autoComplete="tel" value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+91 98765 43210" required className={inputClass(fieldErrors.phone)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Company" error={fieldErrors.companyName}>
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
                <input value={formData.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Your Business" required className={inputClass(fieldErrors.companyName)} />
              </Field>
              <Field label="City" error={fieldErrors.city}>
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
                <input value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Mumbai" required className={inputClass(fieldErrors.city)} />
              </Field>
            </div>

            <Field label="Password" error={fieldErrors.password}>
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7C73]" />
              <input type={showPassword ? "text" : "password"} autoComplete="new-password"
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Min. 8 characters" required minLength={8}
                className={inputClass(fieldErrors.password, true)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7C73] hover:text-[#9FB0A6]">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </Field>

            {formData.password.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3].map((level) => (
                    <div key={level} className={cn(
                      "h-1 flex-1 rounded-full transition-all duration-300",
                      passwordStrength >= level
                        ? level === 1 ? "bg-[#FB7185]" : level === 2 ? "bg-[#E8C468]" : "bg-[#34D399]"
                        : "bg-white/10"
                    )} />
                  ))}
                </div>
                <div className="space-y-0.5">
                  {passwordChecks.map((check) => (
                    <p key={check.label} className={cn(
                      "text-[11px] flex items-center gap-1.5",
                      check.pass ? "text-[#34D399]" : "text-[#6B7C73]"
                    )}>
                      <span className={cn("w-1 h-1 rounded-full", check.pass ? "bg-[#34D399]" : "bg-[#6B7C73]")} />
                      {check.label}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* DPDP Phase 1.3: explicit consent checkbox — required */}
            <label className={cn(
              "flex items-start gap-2.5 cursor-pointer select-none rounded-lg p-3 border transition-colors",
              fieldErrors.consent
                ? "border-[#FB7185]/50 bg-[#FB7185]/5"
                : "border-white/10 bg-white/[0.03] hover:border-[#34D399]/40"
            )}>
              <input type="checkbox" checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (fieldErrors.consent) {
                    setFieldErrors((prev) => { const n = { ...prev }; delete n.consent; return n; });
                  }
                }}
                className="mt-0.5 w-4 h-4 rounded border-[#6B7C73] bg-white/[0.06] accent-[#34D399] focus:ring-[#34D399]/50 focus:ring-1"
              />
              <span className="text-[12px] text-[#9FB0A6] leading-relaxed">
                I have read and agree to the{" "}
                <Link href="/legal/terms" className="text-[#6FE3B0] hover:underline">Terms of Service</Link>{" "}
                and{" "}
                <Link href="/legal/privacy" className="text-[#6FE3B0] hover:underline">Privacy Policy</Link>,
                and I consent to LeadBridge processing my information as described in the Privacy
                Policy. I can withdraw consent anytime.
              </span>
            </label>
            {fieldErrors.consent && (
              <p className="mt-1 text-[11px] text-[#FB7185]">{fieldErrors.consent}</p>
            )}

            <button type="submit" disabled={loading}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-[13px] font-bold transition-all duration-150 hover:shadow-[0_0_32px_rgba(52,211,153,0.4)] active:scale-[0.98]",
                loading && "opacity-70 cursor-not-allowed"
              )}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-[#0A0F0C]/30 border-t-[#0A0F0C] rounded-full animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-[13px] text-[#9FB0A6]">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-[#6FE3B0] hover:underline font-medium">Sign in</Link>
            </p>
          </div>
          </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────── */
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] text-[#9FB0A6] mb-1.5">{label}</label>
      <div className="relative">{children}</div>
      {error && <p className="mt-1 text-[11px] text-[#FB7185]">{error}</p>}
    </div>
  );
}

function inputClass(error?: string, hasRightIcon?: boolean) {
  return cn(
    "w-full py-2.5 rounded-lg bg-white/[0.05] border text-[13px] text-[#F0F7F3] placeholder-[#6B7C73] focus:outline-none focus:ring-1 transition-colors",
    error
      ? "border-[#FB7185]/50 focus:border-[#FB7185]/50 focus:ring-[#FB7185]/30"
      : "border-white/10 focus:border-[#34D399]/60 focus:ring-[#34D399]/30",
    hasRightIcon ? "pl-10 pr-10" : "pl-10 pr-4"
  );
}

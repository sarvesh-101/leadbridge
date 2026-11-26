"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { CAPTURE_LINE } from "@/lib/site";

/**
 * V2 (T6/T10) — "Get a test call in 30 seconds" funnel.
 *
 * Step 1: name + phone (+ honeypot). Step 2: OTP. Step 3: honest status.
 * Accessible: labelled inputs, focus order, keyboard-friendly buttons.
 */
type Step = "request" | "verify" | "done";

export default function DemoPage() {
  const [step, setStep] = useState<Step>("request");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState(""); // honeypot — humans never see it
  const [captchaToken, setCaptchaToken] = useState("");
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCall(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ requestId?: string; message?: string }>("/public/demo/request", {
        name,
        phone,
        company,
        captchaToken,
      });
      if (res.requestId) {
        setRequestId(res.requestId);
        setStep("verify");
        setMessage(res.message || "Code sent. Enter it below.");
      } else {
        setStep("done");
        setMessage(res.message || "We already have your request.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not start the demo. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ message?: string }>("/public/demo/verify", { requestId, phone, otp });
      setStep("done");
      setMessage(res.message || "Verified. Your phone will ring in about 30 seconds.");
    } catch (err: any) {
      setError(err?.response?.data?.error || "That code did not work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-ink flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="text-[13px] text-ink-soft hover:text-ink">← Back to Converza</Link>

        <h1 className="text-[28px] font-display font-bold mt-6 mb-2">Get a test call</h1>
        <p className="text-[14px] text-ink-soft mb-8">
          A real AI call to your own phone, in Hinglish. {CAPTURE_LINE}.
        </p>

        {step === "request" && (
          <form onSubmit={requestCall} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-[12px] text-ink-soft mb-1.5">Your name</label>
              <input
                id="name" required value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-white/[0.04] border border-line px-4 py-3 text-[15px] outline-none focus:border-brand"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-[12px] text-ink-soft mb-1.5">Mobile number</label>
              <input
                id="phone" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg bg-white/[0.04] border border-line px-4 py-3 text-[15px] outline-none focus:border-brand"
                autoComplete="tel"
              />
            </div>

            {/* Honeypot: hidden from humans, never announced to screen readers. */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="company">Company</label>
              <input id="company" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>

            <div>
              <label htmlFor="captcha" className="block text-[12px] text-ink-soft mb-1.5">
                Verification token (only if the form shows a captcha)
              </label>
              <input
                id="captcha" value={captchaToken} onChange={(e) => setCaptchaToken(e.target.value)}
                className="w-full rounded-lg bg-white/[0.04] border border-line px-4 py-2.5 text-[13px] outline-none focus:border-brand"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-soft text-canvas font-bold py-3.5 disabled:opacity-60"
            >
              {loading ? "Starting…" : "Call me in 30 seconds"}
            </button>
            <p className="text-[11px] text-ink-muted">
              Calls run 9 AM to 9 PM IST. Request outside those hours and we call when the window opens.
            </p>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-[12px] text-ink-soft mb-1.5">6-digit code</label>
              <input
                id="otp" required inputMode="numeric" maxLength={6} value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg bg-white/[0.04] border border-line px-4 py-3 text-[20px] tracking-[0.4em] outline-none focus:border-brand"
              />
            </div>
            <button
              type="submit" disabled={loading || otp.length !== 6}
              className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-soft text-canvas font-bold py-3.5 disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify and call me"}
            </button>
            <button type="button" onClick={() => setStep("request")} className="w-full text-[12px] text-ink-soft py-2">
              Use a different number
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="rounded-xl border border-brand/30 bg-brand/10 p-5">
            <p className="text-[15px] text-ink">{message}</p>
            <p className="text-[12px] text-ink-soft mt-2">We never retry a demo call. If you miss it, request another one tomorrow.</p>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-[13px] text-danger">{error}</p>}
        {message && step !== "done" && <p className="mt-3 text-[12px] text-ink-soft">{message}</p>}
      </div>
    </main>
  );
}

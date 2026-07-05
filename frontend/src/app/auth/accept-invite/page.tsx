"use client";

import { Suspense } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Users } from "lucide-react";
import Link from "next/link";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);


  async function handleAccept() {
    if (!password || password.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    setAccepting(true);
    try {
      await api.post("/team/accept-invite", {
        token,
        email,
        password,
      }, { skipAuth: true });
      setAccepted(true);
      toast.success("You've joined the team! You can now log in.");
    } catch (err: any) {
      toast.error(err.message || "Failed to accept invitation. The link may have expired.");
    } finally {
      setAccepting(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#111118] border border-white/10 text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-white mb-2">Invalid Invitation</h1>
        <p className="text-sm text-gray-500 mb-6">This invitation link is invalid or has expired.</p>
        <Link href="/auth/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  if (accepted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 rounded-2xl bg-[#111118] border border-white/10 text-center"
      >
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-white mb-2">Welcome to the Team!</h1>
        <p className="text-sm text-gray-500 mb-6">Your account is set up. You can now log in with your email and password.</p>
        <Link href="/auth/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium"
        >
          Go to Login
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-[#4F6EF7] flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white">LeadBridge</span>
      </div>

      <div className="p-8 rounded-2xl bg-[#111118] border border-white/10">
        <h1 className="text-xl font-semibold text-white mb-2">You're Invited!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Set up your account for <strong className="text-white">{email}</strong>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-leadflow-500/50"
            />
          </div>
        </div>

        <button
          onClick={handleAccept}
          disabled={!password || accepting}
          className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-leadflow-500 to-leadflow-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {accepting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Setting up...</>
          ) : (
            <><Users className="w-4 h-4" /> Join Team</>
          )}
        </button>
      </div>
    </motion.div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#4F6EF7] animate-spin" />
        </div>
      }>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}

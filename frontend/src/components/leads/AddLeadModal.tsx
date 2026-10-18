"use client";

import { useState } from "react";
import { X, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import type { Lead } from "../../types";

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (lead: Lead) => void;
}

/**
 * Manual lead entry — previously the "Add Lead" button had no onClick and the
 * server POST /leads route (dedupe, call enqueue, property matching) was
 * unreachable from the UI. On success the AI agent calls the lead within 60s.
 */
export function AddLeadModal({ open, onClose, onCreated }: AddLeadModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [property, setProperty] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setProperty("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedPhone) {
      toast.error("Name and phone number are required");
      return;
    }

    setSubmitting(true);
    try {
      const data = (await api.post("/leads", {
        name: trimmedName,
        phone: trimmedPhone,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(property.trim() ? { source: property.trim() } : {}),
      })) as { lead: Lead; duplicate?: boolean };

      if (data.duplicate) {
        toast.info("Duplicate lead — this number already exists (last 30 days). Not re-called.");
      } else {
        toast.success("Lead added! AI agent will call within 60 seconds.");
      }
      onCreated?.(data.lead);
      reset();
      onClose();
    } catch (err: unknown) {
      const error = err as Error & { data?: { error?: string } };
      toast.error(error.data?.error || error.message || "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#101713] shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-[#F0F7F3]">Add Lead</h2>
            <p className="text-xs text-[#9FB0A6] mt-0.5 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-[#6FE3B0]" />
              AI agent will call this lead within 60 seconds
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3.5">
          <div>
            <label htmlFor="lead-name" className="block text-xs font-medium text-[#9FB0A6] mb-1.5">
              Full Name <span className="text-[#6FE3B0]">*</span>
            </label>
            <input
              id="lead-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rohan Sharma"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-[#0A0F0C] border border-white/10 text-[#F0F7F3] text-sm placeholder:text-[#5B6B61] focus:outline-none focus:border-[#34D399]/50 focus:ring-1 focus:ring-[#34D399]/30 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="lead-phone" className="block text-xs font-medium text-[#9FB0A6] mb-1.5">
              Phone Number <span className="text-[#6FE3B0]">*</span>
            </label>
            <input
              id="lead-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-3 py-2 rounded-lg bg-[#0A0F0C] border border-white/10 text-[#F0F7F3] text-sm placeholder:text-[#5B6B61] focus:outline-none focus:border-[#34D399]/50 focus:ring-1 focus:ring-[#34D399]/30 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="lead-email" className="block text-xs font-medium text-[#9FB0A6] mb-1.5">
              Email <span className="text-[#5B6B61]">(optional)</span>
            </label>
            <input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. rohan@gmail.com"
              className="w-full px-3 py-2 rounded-lg bg-[#0A0F0C] border border-white/10 text-[#F0F7F3] text-sm placeholder:text-[#5B6B61] focus:outline-none focus:border-[#34D399]/50 focus:ring-1 focus:ring-[#34D399]/30 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="lead-source" className="block text-xs font-medium text-[#9FB0A6] mb-1.5">
              Source <span className="text-[#5B6B61]">(optional)</span>
            </label>
            <input
              id="lead-source"
              type="text"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              placeholder="e.g. Walk-in, Reference, 99acres"
              className="w-full px-3 py-2 rounded-lg bg-[#0A0F0C] border border-white/10 text-[#F0F7F3] text-sm placeholder:text-[#5B6B61] focus:outline-none focus:border-[#34D399]/50 focus:ring-1 focus:ring-[#34D399]/30 transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-[#9FB0A6] text-sm font-medium hover:bg-white/[0.04] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#34D399] to-[#2D6A4F] text-[#0A0F0C] text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add Lead"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

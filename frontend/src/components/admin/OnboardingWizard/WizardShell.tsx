"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowLeft, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const STEPS = [
  { id: 1, label: "Business Info" },
  { id: 2, label: "Territory" },
  { id: 3, label: "Contact" },
  { id: 4, label: "Script" },
  { id: 5, label: "Pricing" },
  { id: 6, label: "Review" },
];

export default function WizardShell() {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    if (currentStep < 6) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      {/* Header */}
      <div className="border-b border-[#2A2A3A] bg-[#111118]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/admin/dashboard" className="inline-flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#4F6EF7] flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-[15px] font-display font-bold text-[#F0F0F8]">LeadBridge</span>
            <span className="text-[12px] text-[#6B6B8A]">· Admin</span>
          </Link>

          {/* Stepper */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold border-2 transition-all duration-300",
                    step.id < currentStep
                      ? "bg-[#22D3A5] border-[#22D3A5] text-white"
                      : step.id === currentStep
                      ? "bg-[#4F6EF7] border-[#4F6EF7] text-white"
                      : "bg-transparent border-[#2A2A3A] text-[#6B6B8A]"
                  )}>
                    {step.id < currentStep ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] mt-1 font-medium hidden sm:block",
                    step.id === currentStep ? "text-[#F0F0F8]" : "text-[#6B6B8A]"
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-[2px] mx-2 transition-colors duration-300",
                    step.id < currentStep ? "bg-[#22D3A5]" : "bg-[#2A2A3A]"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.15, ease: "easeInOut" }}
            >
              {currentStep === 1 && <Step1 />}
              {currentStep === 2 && <Step2 />}
              {currentStep === 3 && <Step3 />}
              {currentStep === 4 && <Step4 />}
              {currentStep === 5 && <Step5 />}
              {currentStep === 6 && <Step6 />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#2A2A3A]">
          <button
            onClick={goBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2A2A3A] text-[13px] text-[#6B6B8A] hover:bg-[#1A1A24] hover:text-[#F0F0F8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < 6 ? (
            <button
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#4F6EF7] text-white text-[13px] font-semibold hover:brightness-110 transition-all"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#22D3A5] text-black text-[13px] font-semibold hover:brightness-110 transition-all">
              <Check className="w-4 h-4" />
              Create Client
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step Components ──────────────────────────────────────────── */

function Step1() {
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-display font-bold text-[#F0F0F8]">Business Information</h2>
      <p className="text-[14px] text-[#6B6B8A]">Enter the broker&apos;s business details.</p>
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Business Name" placeholder="e.g. Sharma Realty" />
        <InputField label="Owner Name" placeholder="e.g. Rajesh Sharma" />
        <InputField label="Email" placeholder="owner@example.com" type="email" />
        <InputField label="Phone" placeholder="+91 98765 43210" />
      </div>
    </div>
  );
}

function Step2() {
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-display font-bold text-[#F0F0F8]">Territory Selection</h2>
      <p className="text-[14px] text-[#6B6B8A]">Assign the exclusive territory for this broker.</p>
      <div className="grid grid-cols-2 gap-4">
        <InputField label="City" placeholder="e.g. Mumbai" />
        <InputField label="Zone / Area" placeholder="e.g. Andheri West" />
      </div>
    </div>
  );
}

function Step3() {
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-display font-bold text-[#F0F0F8]">Contact Settings</h2>
      <p className="text-[14px] text-[#6B6B8A]">Set up WhatsApp and calling preferences.</p>
      <div className="grid grid-cols-2 gap-4">
        <InputField label="WhatsApp Number" placeholder="+91 98765 43210" />
        <InputField label="Calling Language" placeholder="e.g. Hindi, English" />
        <InputField label="Max Call Attempts" placeholder="e.g. 3" type="number" />
        <InputField label="Call Window" placeholder="e.g. 9AM - 8PM" />
      </div>
    </div>
  );
}

function Step4() {
  const [script, setScript] = useState(`Namaste! Main LeadBridge AI assistant bol raha hoon.
Maine aapko online property enquiry ke baare mein call kiya hai.
Kya aapko [Property Type] mein interested hain?
Aapka budget kya hai?
Kya main aapki site visit book kar doon?`);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { api } = await import("@/lib/api");
      const response = await api.post("/ai/generate-script", {
        businessName: "Your Business",
        language: "hinglish",
      });
      const generatedScript = response.script || `Namaste! Main LeadBridge se bol raha hoon.
Aapne abhi enquiry kiya tha.
Kya main aapko property ke baare mein thodi jaankari de sakta hoon?
Aap konse area mein dekh rahe hain?
Aapka budget kya hai?
Kya main aapki site visit book kar doon?`;
      setScript(generatedScript);
    } catch (err) {
      console.error("Failed to generate script:", err);
      setScript(`Namaste! Main LeadBridge se bol raha hoon.
Aapne abhi enquiry kiya tha.
Kya main aapko property ke baare mein thodi jaankari de sakta hoon?
Aap konse area mein dekh rahe hain?
Aapka budget kya hai?
Kya main aapki site visit book kar doon?`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-display font-bold text-[#F0F0F8]">Script Configuration</h2>
      <p className="text-[14px] text-[#6B6B8A]">Configure the AI calling script. Hover over lines to highlight.</p>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#6B6B8A]">Script Editor</span>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4F6EF7] text-white text-[12px] font-medium hover:brightness-110 disabled:opacity-60 transition-all"
            >
              {generating ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              Generate with AI
            </button>
          </div>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="w-full h-[300px] px-4 py-3 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-[13px] text-[#F0F0F8] font-mono leading-relaxed focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7] resize-none transition-colors"
            placeholder="Enter the AI calling script..."
          />
        </div>

        {/* Right: Phone Preview */}
        <div>
          <span className="text-[12px] text-[#6B6B8A] mb-2 block">Live Preview</span>
          <div className="rounded-lg bg-[#0A0A0F] border border-[#2A2A3A] p-4 h-[300px] flex flex-col">
            {/* Phone frame */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#2A2A3A]">
                <div className="w-8 h-8 rounded-full bg-[#22D3A5]/20 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#22D3A5]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#F0F0F8]">LeadBridge AI</p>
                  <p className="text-[11px] text-[#22D3A5]">Calling...</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {script.split("\n").filter(Boolean).map((line, i) => (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] px-3 py-2 rounded-lg bg-[#1A1A24] text-[13px] text-[#F0F0F8] rounded-br-sm leading-relaxed">
                      {line}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 text-center">
              <button className="px-4 py-1.5 rounded-full bg-[#22D3A5] text-black text-[11px] font-semibold hover:brightness-110 transition-all">
                Preview Audio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step5() {
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-display font-bold text-[#F0F0F8]">Pricing Plan</h2>
      <p className="text-[14px] text-[#6B6B8A]">Select the plan and set call limits.</p>
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: "Starter", price: "₹18,000", calls: "100" },
          { name: "Growth", price: "₹35,000", calls: "300", popular: true },
          { name: "Pro", price: "₹60,000", calls: "Unlimited" },
        ].map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "p-5 rounded-lg border cursor-pointer transition-all hover:translate-y-[-2px]",
              plan.popular
                ? "border-[#4F6EF7] bg-[#4F6EF7]/5"
                : "border-[#2A2A3A] bg-[#111118] hover:border-[#4F6EF7]/50"
            )}
          >
            {plan.popular && (
              <span className="text-[10px] font-semibold text-[#C9A84C] uppercase tracking-wider">Recommended</span>
            )}
            <h3 className="text-[18px] font-display font-bold text-[#F0F0F8] mt-1">{plan.name}</h3>
            <p className="text-[24px] font-display font-bold text-[#F0F0F8] mt-2">{plan.price}<span className="text-[12px] text-[#6B6B8A]">/mo</span></p>
            <p className="text-[13px] text-[#6B6B8A] mt-1">{plan.calls} AI calls</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step6() {
  return (
    <div className="space-y-4">
      <h2 className="text-[22px] font-display font-bold text-[#F0F0F8]">Review & Confirm</h2>
      <p className="text-[14px] text-[#6B6B8A]">Review the client details before creating the account.</p>
      <div className="rounded-lg bg-[#111118] border border-[#2A2A3A] p-6 space-y-3">
        {[
          ["Business", "Sharma Realty"],
          ["Owner", "Rajesh Sharma"],
          ["City", "Mumbai - Andheri West"],
          ["Plan", "Growth (₹35,000/mo)"],
          ["Script", "4 lines configured"],
          ["Status", "Active immediately"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2 border-b border-[#2A2A3A] last:border-0">
            <span className="text-[13px] text-[#6B6B8A]">{label}</span>
            <span className="text-[13px] text-[#F0F0F8] font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Input Field Helper ───────────────────────────────────────── */
function InputField({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="block text-[12px] text-[#6B6B8A] mb-1.5">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-[13px] text-[#F0F0F8] placeholder-[#3A3A52] focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7] transition-colors"
      />
    </div>
  );
}

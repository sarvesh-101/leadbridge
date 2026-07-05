"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Zap, Phone, Bot, Radio, Check, ArrowRight,
  Loader2, Smartphone, Globe, Play, ExternalLink,
  MapPin, MessageSquare, Wifi, ListChecks,
} from "lucide-react";

type SetupStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS = [
  { id: 1, label: "Welcome", icon: Zap },
  { id: 2, label: "Agent Config", icon: Bot },
  { id: 3, label: "Territory", icon: MapPin },
  { id: 4, label: "WhatsApp", icon: MessageSquare },
  { id: 5, label: "Lead Sources", icon: ListChecks },
  { id: 6, label: "Phone Setup", icon: Smartphone },
  { id: 7, label: "Test Call", icon: Play },
];

const ALL_SOURCES = [
  { id: "99acres", label: "99acres" },
  { id: "magicbricks", label: "MagicBricks" },
  { id: "housing", label: "Housing.com" },
  { id: "justdial", label: "JustDial" },
  { id: "facebook", label: "Facebook" },
  { id: "google", label: "Google" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "website", label: "Your Website" },
  { id: "referral", label: "Referrals" },
];

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [phoneSetupStatus, setPhoneSetupStatus] = useState<string>("PENDING");

  // Agent config
  const [agentName, setAgentName] = useState("");
  const [agentLanguage, setAgentLanguage] = useState("hinglish");
  const [knowledgeBase, setKnowledgeBase] = useState("");

  // Territory
  const [city, setCity] = useState("");
  const [zone, setZone] = useState("");

  // WhatsApp
  const [ownerWhatsapp, setOwnerWhatsapp] = useState("");

  // Lead Sources
  const [selectedSources, setSelectedSources] = useState<string[]>(["99acres", "magicbricks"]);

  // Phone numbers
  const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState<number | null>(null);
  const [agentId, setAgentId] = useState<number | null>(null);

  // Test call
  const [testCallLoading, setTestCallLoading] = useState(false);
  const [testCallResult, setTestCallResult] = useState<string | null>(null);

  // Check current setup status on mount
  useEffect(() => {
    const loadSetupStatus = async () => {
      try {
        const [meRes, phonesRes] = await Promise.all([
          api.get<any>("/me"),
          api.get<any>("/voice/phone-numbers").catch(() => ({ numbers: [] })),
        ]);
        setPhoneNumbers(phonesRes.numbers || []);
        setPhoneSetupStatus(meRes.client?.phoneSetupStatus || "PENDING");
        setAgentId(meRes.client?.omniAgentId ? parseInt(meRes.client.omniAgentId) : null);
        setAgentName(meRes.client?.businessName ? `${meRes.client.businessName} AI Agent` : "");
        setOwnerWhatsapp(meRes.client?.ownerWhatsapp || "");
        setCity(meRes.client?.city || "");
        setZone(meRes.client?.zone || "");

        if (meRes.client?.phoneSetupStatus === "LIVE") {
          router.push("/dashboard");
        } else if (meRes.client?.phoneSetupStatus === "NUMBER_CONNECTED") {
          setCurrentStep(7);
        } else if (meRes.client?.omniAgentId) {
          setCurrentStep(6);
        }
      } catch {
        // Not authenticated or error — ignore
      }
    };
    loadSetupStatus();
  }, [router]);

  // ─── Step 2: Agent Config ──────────────────────────────────────
  const handleCreateAgent = async () => {
    if (!agentName.trim()) return toast.error("Agent name is required");
    setLoading("create-agent");
    try {
      const res = await api.post<{ agent: any; isAssigned: boolean }>("/voice/agents", {
        name: agentName,
        language: agentLanguage,
        systemPrompt: knowledgeBase
          ? `You are an AI real estate assistant for ${agentName}. ${knowledgeBase}`
          : undefined,
      });
      setAgentId(res.agent.id);
      toast.success("AI agent created!");
      await saveProfile();
      setCurrentStep(3);
    } catch (err: any) {
      toast.error(err.message || "Failed to create agent");
    } finally {
      setLoading(null);
    }
  };

  // ─── Step 3: Territory ─────────────────────────────────────────
  const handleSaveTerritory = async () => {
    if (!city.trim()) return toast.error("City is required");
    setLoading("save-territory");
    try {
      await saveProfile();
      // Claim territory if available
      await api.post("/territories/claim", { city: city.trim(), zone: zone.trim() || undefined }).catch(() => {});
      toast.success("Territory saved!");
      setCurrentStep(4);
    } catch (err: any) {
      toast.error(err.message || "Failed to save territory");
    } finally {
      setLoading(null);
    }
  };

  // ─── Step 4: WhatsApp ──────────────────────────────────────────
  const handleSaveWhatsApp = async () => {
    if (!ownerWhatsapp.trim()) return toast.error("WhatsApp number is required");
    setLoading("save-whatsapp");
    try {
      await saveProfile();
      toast.success("WhatsApp number saved!");
      setCurrentStep(5);
    } catch (err: any) {
      toast.error(err.message || "Failed to save WhatsApp");
    } finally {
      setLoading(null);
    }
  };

  // ─── Step 5: Lead Sources ──────────────────────────────────────
  const handleSaveSources = async () => {
    if (selectedSources.length === 0) return toast.error("Select at least one lead source");
    setLoading("save-sources");
    try {
      await saveProfile();
      toast.success("Lead sources configured!");
      setCurrentStep(6);
    } catch (err: any) {
      toast.error(err.message || "Failed to save sources");
    } finally {
      setLoading(null);
    }
  };

  async function saveProfile() {
    const data: Record<string, any> = {};
    if (city) data.city = city;
    if (zone) data.zone = zone;
    if (ownerWhatsapp) data.ownerWhatsapp = ownerWhatsapp;
    if (selectedSources.length > 0) data.leadSources = selectedSources.map(s => ({ name: s }));
    await api.patch("/me", data);
  }

  // ─── Step 6: Phone Setup ──────────────────────────────────────
  const handleSelectPhone = async () => {
    if (!selectedPhoneId || !agentId) return;
    setLoading("attach-phone");
    try {
      await api.post("/voice/phone-numbers/attach", {
        phoneNumberId: selectedPhoneId,
        agentId,
      });
      setPhoneSetupStatus("NUMBER_CONNECTED");
      toast.success("Phone number connected!");
      setCurrentStep(7);
    } catch (err: any) {
      toast.error(err.message || "Failed to connect phone");
    } finally {
      setLoading(null);
    }
  };

  const handleSkipPhone = () => setCurrentStep(7);

  // ─── Step 7: Test Call ────────────────────────────────────────
  const handleTestCall = async () => {
    setTestCallLoading(true);
    setTestCallResult(null);
    try {
      const res = await api.post<{ message: string; requestId: number }>("/voice/test-call");
      setTestCallResult(res.requestId.toString());
      toast.success("Test call initiated! Your phone should ring shortly.");
    } catch (err: any) {
      toast.error(err.message || "Test call failed");
      setTestCallResult("failed");
    } finally {
      setTestCallLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading("finish");
    try {
      // Mark completion
      await api.patch("/me", {
        phoneSetupStatus: "LIVE",
        onboardingComplete: true,
      });
      toast.success("Setup complete! Redirecting...");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to complete setup");
    } finally {
      setLoading(null);
    }
  };

  // ─── Render Steps ─────────────────────────────────────────────

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-lg mx-auto space-y-6"
          >
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#4F6EF7] to-[#4F6EF7]/60 flex items-center justify-center">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welcome to LeadBridge! 🎉</h2>
              <p className="text-[#6B6B8A] mt-3 leading-relaxed">
                This 7-step setup will get your AI calling system running in under 5 minutes.
              </p>
            </div>
            <div className="space-y-3 text-left bg-white/[0.03] rounded-xl p-5 border border-white/[0.06]">
              {[
                { icon: Bot, title: "Create AI Agent", desc: "Configure your voice agent's language and knowledge" },
                { icon: MapPin, title: "Set Territory", desc: "Define your exclusive city/zone" },
                { icon: MessageSquare, title: "Connect WhatsApp", desc: "Link your WhatsApp number for notifications" },
                { icon: ListChecks, title: "Lead Sources", desc: "Choose where your leads come from" },
                { icon: Smartphone, title: "Connect Phone Number", desc: "Attach a calling number to your agent" },
                { icon: Play, title: "Test Call", desc: "Verify everything works" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#4F6EF7]/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-[#4F6EF7]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-[#6B6B8A]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#4F6EF7]/80 text-white font-medium hover:opacity-90 transition-opacity"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div key="step2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto space-y-5"
          >
            <div className="text-center mb-2">
              <Bot className="w-10 h-10 text-[#4F6EF7] mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Configure AI Agent</h2>
              <p className="text-sm text-[#6B6B8A] mt-1">Create your voice agent that will call leads automatically.</p>
            </div>
            <div>
              <label className="block text-sm text-[#A0A0C0] mb-1.5">Agent Name</label>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)}
                placeholder="My Real Estate AI Agent"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50 placeholder:text-[#4A4A62]" />
            </div>
            <div>
              <label className="block text-sm text-[#A0A0C0] mb-1.5">Language</label>
              <select value={agentLanguage} onChange={(e) => setAgentLanguage(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50">
                <option value="hinglish">Hinglish (Hindi + English)</option>
                <option value="hindi">Hindi</option>
                <option value="english">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#A0A0C0] mb-1.5">Knowledge Base <span className="text-[#4A4A62]">(optional)</span></label>
              <textarea value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)}
                placeholder="Describe your properties, areas you cover, and any special offers..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50 placeholder:text-[#4A4A62] resize-none" />
              <p className="text-xs text-[#6B6B8A] mt-1.5">The AI uses this info to answer prospect questions naturally.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(3)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#6B6B8A] hover:bg-white/10">
                Skip
              </button>
              <button onClick={handleCreateAgent}
                disabled={loading === "create-agent" || !agentName.trim()}
                className="flex-[2] flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#4F6EF7]/80 text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {loading === "create-agent" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating Agent...</>
                ) : (
                  <><Bot className="w-4 h-4" /> Create & Continue</>
                )}
              </button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div key="step3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto space-y-5"
          >
            <div className="text-center mb-2">
              <MapPin className="w-10 h-10 text-[#4F6EF7] mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Set Your Territory</h2>
              <p className="text-sm text-[#6B6B8A] mt-1">Define your exclusive service area. One broker per territory.</p>
            </div>
            <div>
              <label className="block text-sm text-[#A0A0C0] mb-1.5">City *</label>
              <input value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Mumbai, Delhi, Bangalore"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50 placeholder:text-[#4A4A62]" />
            </div>
            <div>
              <label className="block text-sm text-[#A0A0C0] mb-1.5">Zone / Area <span className="text-[#4A4A62]">(optional)</span></label>
              <input value={zone} onChange={(e) => setZone(e.target.value)}
                placeholder="e.g., Andheri West, Whitefield"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50 placeholder:text-[#4A4A62]" />
              <p className="text-xs text-[#6B6B8A] mt-1.5">Leads from your territory are exclusively routed to you.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(4)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#6B6B8A] hover:bg-white/10">
                Skip
              </button>
              <button onClick={handleSaveTerritory}
                disabled={loading === "save-territory"}
                className="flex-[2] flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#4F6EF7]/80 text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {loading === "save-territory" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="w-4 h-4" /> Save Territory</>
                )}
              </button>
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div key="step4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto space-y-5"
          >
            <div className="text-center mb-2">
              <MessageSquare className="w-10 h-10 text-[#22D3A5] mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Connect WhatsApp</h2>
              <p className="text-sm text-[#6B6B8A] mt-1">Receive real-time notifications about new leads, bookings, and alerts.</p>
            </div>
            <div>
              <label className="block text-sm text-[#A0A0C0] mb-1.5">Your WhatsApp Number *</label>
              <input value={ownerWhatsapp} onChange={(e) => setOwnerWhatsapp(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4F6EF7]/50 placeholder:text-[#4A4A62]" />
              <p className="text-xs text-[#6B6B8A] mt-1.5">
                You'll get instant alerts for new leads, booking confirmations, no-shows, and deal conversions.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(5)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#6B6B8A] hover:bg-white/10">
                Skip
              </button>
              <button onClick={handleSaveWhatsApp}
                disabled={loading === "save-whatsapp" || !ownerWhatsapp.trim()}
                className="flex-[2] flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#22D3A5] to-[#22D3A5]/80 text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {loading === "save-whatsapp" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="w-4 h-4" /> Save Number</>
                )}
              </button>
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div key="step5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto space-y-5"
          >
            <div className="text-center mb-2">
              <ListChecks className="w-10 h-10 text-[#F59E0B] mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Lead Sources</h2>
              <p className="text-sm text-[#6B6B8A] mt-1">Select where your leads come from so we can set up the right integrations.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SOURCES.map((src) => {
                const isSelected = selectedSources.includes(src.id);
                return (
                  <button key={src.id} onClick={() => {
                    setSelectedSources(prev =>
                      isSelected ? prev.filter(s => s !== src.id) : [...prev, src.id]
                    );
                  }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm text-left transition-all",
                      isSelected
                        ? "bg-[#F59E0B]/10 border-[#F59E0B]/30 text-white"
                        : "bg-white/5 border-white/10 text-[#A0A0C0] hover:bg-white/10"
                    )}>
                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center",
                      isSelected ? "border-[#F59E0B] bg-[#F59E0B]" : "border-[#3A3A52]"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span>{src.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#6B6B8A] text-center">
              You can configure webhook integration for each source later in Settings.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(6)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#6B6B8A] hover:bg-white/10">
                Skip
              </button>
              <button onClick={handleSaveSources}
                disabled={loading === "save-sources" || selectedSources.length === 0}
                className="flex-[2] flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/80 text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {loading === "save-sources" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="w-4 h-4" /> Save Sources</>
                )}
              </button>
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div key="step6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto space-y-5"
          >
            <div className="text-center mb-2">
              <Smartphone className="w-10 h-10 text-[#4F6EF7] mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Connect Phone Number</h2>
              <p className="text-sm text-[#6B6B8A] mt-1">Attach a phone number to your AI agent so it can call leads.</p>
            </div>
            {phoneNumbers.length === 0 ? (
              <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06] text-center space-y-4">
                <Globe className="w-12 h-12 text-[#3A3A52] mx-auto" />
                <div>
                  <p className="text-sm text-white font-medium">No phone numbers available</p>
                  <p className="text-xs text-[#6B6B8A] mt-1">Purchase a number from the Omnidimension dashboard, then refresh here.</p>
                </div>
                <button onClick={() => window.open("https://app.omnidim.io", "_blank")}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10">
                  Open Omnidimension Dashboard <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {phoneNumbers.map((pn) => (
                  <button key={pn.id} onClick={() => setSelectedPhoneId(pn.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                      selectedPhoneId === pn.id
                        ? "bg-[#4F6EF7]/10 border-[#4F6EF7]/30 text-white"
                        : "bg-white/5 border-white/10 text-[#A0A0C0] hover:bg-white/10"
                    )}>
                    <Radio className={cn("w-5 h-5", selectedPhoneId === pn.id ? "text-[#4F6EF7]" : "text-[#6B6B8A]")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{pn.phone_number}</p>
                      <p className="text-xs text-[#6B6B8A]">{pn.name || "Unnamed"}</p>
                    </div>
                    {selectedPhoneId === pn.id && <Check className="w-4 h-4 text-[#4F6EF7]" />}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              {phoneNumbers.length > 0 && (
                <button onClick={handleSelectPhone}
                  disabled={loading === "attach-phone" || !selectedPhoneId}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#4F6EF7]/80 text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                  {loading === "attach-phone" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                  ) : (
                    <><Check className="w-4 h-4" /> Connect Number</>
                  )}
                </button>
              )}
              <button onClick={handleSkipPhone}
                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#6B6B8A] hover:bg-white/10">
                Skip
              </button>
            </div>
          </motion.div>
        );

      case 7:
        return (
          <motion.div key="step7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto space-y-5"
          >
            <div className="text-center mb-2">
              <Play className="w-10 h-10 text-[#22D3A5] mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Test Your Setup</h2>
              <p className="text-sm text-[#6B6B8A] mt-1">We'll call your phone so you can hear how the AI sounds.</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.06] text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#22D3A5]/20 to-[#22D3A5]/5 flex items-center justify-center">
                <Phone className="w-8 h-8 text-[#22D3A5]" />
              </div>
              <p className="text-sm text-[#6B6B8A]">
                When you click "Test Call", your registered phone number will ring within 30 seconds.
              </p>
              <button onClick={handleTestCall} disabled={testCallLoading}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#22D3A5] to-[#22D3A5]/80 text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {testCallLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Calling...</>
                ) : (
                  <><Phone className="w-4 h-4" /> Test Call</>
                )}
              </button>
              {testCallResult && <p className="text-sm text-[#22D3A5]">✅ Test call initiated! Check your phone.</p>}
            </div>
            <button onClick={handleFinish} disabled={loading === "finish"}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#4F6EF7] to-[#4F6EF7]/80 text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
              {loading === "finish" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Completing Setup...</>
              ) : (
                <><Check className="w-4 h-4" /> Complete Setup → Dashboard</>
              )}
            </button>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      <header className="flex items-center justify-between px-6 h-14 border-b border-[#2A2A3A]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4F6EF7] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-[16px] font-bold text-white">LeadBridge Setup</span>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-1 px-4 sm:px-6 py-5 border-b border-[#2A2A3A] overflow-x-auto">
        {STEPS.map((step, i) => {
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className={cn(
                  "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all shrink-0",
                  isComplete && "bg-[#22D3A5] text-white",
                  isActive && "bg-[#4F6EF7] text-white ring-2 ring-[#4F6EF7]/20",
                  !isActive && !isComplete && "bg-white/5 text-[#6B6B8A] border border-white/10",
                )}>
                  {isComplete ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <step.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>
                <span className={cn("text-[10px] sm:text-xs font-medium hidden sm:inline",
                  isActive ? "text-white" : "text-[#6B6B8A]"
                )}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("w-4 sm:w-10 h-[2px] mx-1 sm:mx-2",
                  currentStep > step.id ? "bg-[#22D3A5]" : "bg-white/10"
                )} />
              )}
            </div>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10">
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>
      </main>

      <footer className="px-6 py-3 border-t border-[#2A2A3A] text-center">
        <p className="text-xs text-[#6B6B8A]">Step {currentStep} of 7</p>
      </footer>
    </div>
  );
}

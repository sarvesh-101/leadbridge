"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import {
  PhoneCall, BrainCircuit, MessageSquareText, BarChart3,
  Globe2, Timer, ShieldCheck, Users, Zap, Bot,
  CalendarCheck, TrendingUp, Languages, Target,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI Calling Agent",
    description: "Your own AI telecaller that speaks in Hinglish, qualifies leads, answers FAQs, and books site visits — all within 60 seconds of the lead coming in.",
  },
  {
    icon: Timer,
    title: "60-Second Response",
    description: "Average broker response time is 4-8 hours. We call within 60 seconds — before the lead even clicks away to your competitor.",
  },
  {
    icon: Languages,
    title: "Multilingual (Hinglish)",
    description: "Speaks naturally in Hindi, English, and Hinglish — whatever your lead is most comfortable with. No robotic scripts.",
  },
  {
    icon: CalendarCheck,
    title: "Smart Scheduling",
    description: "AI books site visits based on lead's preferred time, sends reminders, detects no-shows, and auto-reschedules with a follow-up call.",
  },
  {
    icon: BrainCircuit,
    title: "Predictive Lead Scoring",
    description: "Every lead gets a 0-100 conversion score based on source quality, response time, budget fit, timeline urgency, and call sentiment.",
  },
  {
    icon: MessageSquareText,
    title: "WhatsApp Automation",
    description: "Instant WhatsApp notifications for every call outcome, booking confirmation, and follow-up — sent directly to you and your team.",
  },
  {
    icon: Target,
    title: "Smart Campaign Builder",
    description: "Build multi-step drip campaigns with calls, WhatsApp messages, and SMS — triggered by lead source, status, or score.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Live dashboard with conversion funnel, call metrics, booking rates, territory performance, and ROI tracking. Updated in real-time.",
  },
  {
    icon: ShieldCheck,
    title: "Territory Exclusivity",
    description: "One broker per city or zone. Your competitors can't use LeadBridge in your territory. First come, first locked.",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Add your team members with role-based access — Admin, Agent, or Viewer. Share leads, calls, and analytics with your team.",
  },
  {
    icon: Globe2,
    title: "Multi-Source Ingestion",
    description: "Connect 99acres, MagicBricks, Housing.com, JustDial, your website, WhatsApp, or any custom webhook. One inbox for all leads.",
  },
  {
    icon: Zap,
    title: "A/B Testing",
    description: "Test different call scripts, follow-up sequences, and messaging strategies. Let data decide what converts best.",
  },
];

export default function FeatureShowcase() {
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const cards = containerRef.current?.querySelectorAll(".feature-card");
      if (!cards) return;

      gsap.fromTo(cards,
        { opacity: 0, y: 30 },
        {
          opacity: 1, y: 0, duration: 0.5, stagger: 0.05,
          ease: "power2.out",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top 75%",
            toggleActions: "play none none none",
          },
        }
      );

      kill = () => {
        ScrollTrigger.getAll().forEach((st: any) => st.kill());
      };
    };

    init();
    return () => { if (kill) kill(); };
  }, [inView]);

  return (
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0B0D12] overflow-hidden" id="features">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#3B82F6] opacity-[0.02] blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#3B82F6] mb-4 block">POWERED BY AI</span>
          <h2 className="h1-text mb-4">Everything you need to convert more leads</h2>
          <p className="text-[16px] text-[#8B93A3] max-w-[600px] mx-auto">
            From the moment a lead comes in to the moment they visit — every step is automated, optimized, and trackable.
          </p>
        </div>

        <div ref={containerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="feature-card group relative p-6 rounded-xl bg-[#14161C] border border-[#272B34] hover:border-[#363B45] transition-all duration-300 hover:translate-y-[-2px]"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#F2F4F8] mb-1.5 group-hover:text-white transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-[13px] text-[#8B93A3] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(59, 130, 246, 0.04), transparent 40%)" }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (rect) {
                      e.currentTarget.style.setProperty("--mouse-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
                      e.currentTarget.style.setProperty("--mouse-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

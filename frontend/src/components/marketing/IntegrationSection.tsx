"use client";

import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Globe, Smartphone, MessageSquare, Link2, Webhook, Mail } from "lucide-react";

const integrations = [
  {
    name: "99acres",
    type: "Real Estate Portal",
    icon: Globe,
    description: "India's #1 property portal — auto-import leads in real-time",
    active: true,
  },
  {
    name: "MagicBricks",
    type: "Real Estate Portal",
    icon: Globe,
    description: "Second largest property portal with high-intent buyers",
    active: true,
  },
  {
    name: "Housing.com",
    type: "Real Estate Portal",
    icon: Globe,
    description: "Premium property listings with quality leads",
    active: true,
  },
  {
    name: "JustDial",
    type: "Business Directory",
    icon: Smartphone,
    description: "India's largest local search — leads with phone numbers",
    active: true,
  },
  {
    name: "WhatsApp",
    type: "Messaging",
    icon: MessageSquare,
    description: "Leads from WhatsApp Business API — respond instantly",
    active: true,
  },
  {
    name: "Custom Webhook",
    type: "API",
    icon: Webhook,
    description: "Any system that can send an HTTP request — we'll ingest it",
    active: true,
  },
  {
    name: "Website Widget",
    type: "Embed",
    icon: Link2,
    description: "Embed a contact form on your website — leads come directly",
    active: true,
  },
  {
    name: "Email Import",
    type: "Inbound",
    icon: Mail,
    description: "Forward enquiry emails to your LeadBridge inbox",
    active: true,
  },
];

export default function IntegrationSection() {
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inView) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let kill: (() => void) | undefined;

    const init = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const cards = gridRef.current?.querySelectorAll(".integration-card");
      if (!cards) return;

      gsap.fromTo(cards,
        { opacity: 0, y: 20, scale: 0.95 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.05,
          ease: "power2.out",
          scrollTrigger: {
            trigger: gridRef.current,
            start: "top 80%",
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
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0A0A0F]" id="integrations">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="caption text-[#22D3A5] mb-4 block">CONNECT EVERYTHING</span>
          <h2 className="h1-text mb-4">Works with every lead source</h2>
          <p className="text-[16px] text-[#6B6B8A] max-w-[520px] mx-auto">
            No matter where your leads come from — portals, social, web, or WhatsApp — they all land in one inbox.
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {integrations.map((integration, i) => {
            const Icon = integration.icon;
            return (
              <div
                key={i}
                className="integration-card group relative p-5 rounded-xl bg-[#111118] border border-[#2A2A3A] hover:border-[#4F6EF7]/30 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4F6EF7]/20 to-[#4F6EF7]/5 flex items-center justify-center mb-3 border border-[#4F6EF7]/10">
                  <Icon className="w-5 h-5 text-[#4F6EF7]" />
                </div>
                <h3 className="text-[14px] font-semibold text-[#F0F0F8] mb-0.5">{integration.name}</h3>
                <p className="text-[11px] text-[#6B6B8A] mb-2">{integration.type}</p>
                <p className="text-[11px] text-[#3A3A52] leading-relaxed">{integration.description}</p>
                {integration.active && (
                  <span className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#22D3A5]/10 border border-[#22D3A5]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22D3A5]" />
                    <span className="text-[9px] font-medium text-[#22D3A5]">Live</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Flow description */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#111118] border border-[#2A2A3A]">
            <div className="flex items-center gap-1">
              {[Globe, Smartphone, MessageSquare, Webhook].map((Icon, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-[#1A1A24] flex items-center justify-center">
                  <Icon className="w-3 h-3 text-[#4F6EF7]" />
                </div>
              ))}
            </div>
            <span className="text-[13px] text-[#6B6B8A]">
              Any source → LeadBridge AI → You get a WhatsApp notification
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

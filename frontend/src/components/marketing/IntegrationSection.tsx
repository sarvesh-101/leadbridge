"use client";

import { useInView } from "react-intersection-observer";
import { INTEGRATIONS } from "@/lib/integrations.autogen";
import { Globe, Smartphone, MessageSquare, Link2, Webhook, Mail, FileSpreadsheet, Upload } from "lucide-react";

/**
 * V2 (T8/T10) — integration cards read the generated status config.
 * Changing a status in server/src/config/integration-status.ts + regenerating
 * is the only edit needed here. No status is hardcoded in this file.
 */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  website_form: Link2,
  custom_webhook: Webhook,
  csv: Upload,
  manual: Smartphone,
  google_sheets: FileSpreadsheet,
  facebook: Globe,
  indiamart: Globe,
  whatsapp_enquiries: MessageSquare,
  "99acres": Globe,
  magicbricks: Globe,
  housing: Globe,
  justdial: Smartphone,
  email_forwarding: Mail,
  sms_forwarding: MessageSquare,
};

const BADGE: Record<string, string> = {
  LIVE: "bg-[#34D399]/15 border-[#34D399]/30 text-[#6FE3B0]",
  SETUP_ASSISTED: "bg-[#E8C468]/10 border-[#E8C468]/25 text-[#E8C468]",
  IN_SETUP: "bg-white/[0.06] border-white/15 text-[#9FB0A6]",
  COMING_SOON: "bg-white/[0.03] border-white/10 text-[#6B7C73]",
};

export default function IntegrationSection() {
  const { ref } = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <section ref={ref} className="relative py-20 lg:py-32 bg-[#0A0F0C] overflow-hidden" id="integrations">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <span className="caption text-gradient-emerald mb-4 block">CONNECT EVERYTHING</span>
          <h2 className="h1-text mb-4">Works with every lead source</h2>
          <p className="text-[16px] text-[#9FB0A6] max-w-[560px] mx-auto">
            Every source below shows its real status. We never call a connection instant before it is live.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {INTEGRATIONS.sources.map((integration) => {
            const Icon = ICONS[integration.id] || Globe;
            return (
              <div key={integration.id} className="relative p-5 rounded-xl glass-card hover:border-[#34D399]/40 transition-all duration-300">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#34D399]/20 to-[#1B4332]/30 flex items-center justify-center mb-3 border border-[#34D399]/20">
                  <Icon className="w-5 h-5 text-[#6FE3B0]" />
                </div>
                <h3 className="text-[14px] font-semibold text-[#F0F7F3] mb-0.5">{integration.name}</h3>
                <p className="text-[11px] text-[#6B7C73] leading-relaxed mb-3">{integration.note}</p>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${BADGE[integration.availability]}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span className="text-[9px] font-medium">{integration.label}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass-card">
            <span className="text-[13px] text-[#9FB0A6]">
              Any source → Converza AI → you get a WhatsApp summary
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

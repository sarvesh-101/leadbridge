"use client";

/**
 * V2 (T14) — legal page stubs.
 *
 * These cards render on the landing page only so the owner can see the three
 * required legal pages exist with the right headings. They are NOT linked from
 * navigation. Each card is a stub: section headings only, plus a visible
 * [LEGAL REVIEW REQUIRED] marker. No legal text is written here.
 *
 * When a human completes the legal text, these stubs are replaced by the real
 * pages at /legal/privacy, /legal/terms and /legal/ai-calling.
 */
export default function LegalStubs() {
  return (
    <section className="py-16 bg-[#0A0F0C] border-t border-white/[0.06]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="caption text-[#6B7C73] mb-6">Legal pages — draft stubs</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              href: "/legal/privacy",
              title: "Privacy",
              headings: ["What we collect", "Why we collect it", "How long we keep it", "Your rights", "DPDP notice"],
            },
            {
              href: "/legal/terms",
              title: "Terms",
              headings: ["What Converza is", "Accounts and access", "Lead sources and consent", "Billing and refunds", "Termination"],
            },
            {
              href: "/legal/ai-calling",
              title: "AI calling and recording",
              headings: ["What happens on a call", "AI disclosure", "Recording notice", "Calling hours", "DND and consent"],
            },
          ].map((page) => (
            <div
              key={page.href}
              className="p-6 rounded-xl bg-white/[0.03] border border-white/[0.08] text-left"
            >
              <h3 className="text-[14px] font-semibold text-[#F0F7F3] mb-3">{page.title}</h3>
              <ul className="space-y-1.5 text-[12px] text-[#9FB0A6]">
                {page.headings.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <span className="text-[#6B7C73] shrink-0 mt-0.5">·</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[#F59E0B] text-[11px] font-medium">
                [LEGAL REVIEW REQUIRED]
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

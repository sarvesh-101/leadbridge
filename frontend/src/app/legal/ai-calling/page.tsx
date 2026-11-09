import type { Metadata } from "next";

/**
 * V2 (T14) — "AI calling and recording" page.
 *
 * STUB: section headings only. No legal text is written here — that requires a
 * lawyer. The [LEGAL REVIEW REQUIRED] marker stays visible until a human
 * removes it, which is also when this page may be added to navigation.
 */
export const metadata: Metadata = {
  title: "AI calling and recording — Converza",
  robots: { index: false, follow: false },
};

export default function AICallingPage() {
  return (
    <main className="min-h-screen bg-[#0A0F0C] text-[#F0F7F3] px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 rounded-lg border border-[#E8C468]/40 bg-[#E8C468]/10 px-4 py-3 text-[13px] text-[#E8C468]">
          [LEGAL REVIEW REQUIRED] — this page contains headings only. Do not link it publicly until the text is approved.
        </div>

        <h1 className="text-[32px] font-display font-bold mb-8">AI calling and recording</h1>

        <div className="space-y-8 text-[14px] text-[#9FB0A6] leading-relaxed">
          <section>
            <h2 className="text-[16px] font-semibold text-[#F0F7F3] mb-2">1. That the call is handled by an AI</h2>
            <p>[Pending legal review]</p>
          </section>
          <section>
            <h2 className="text-[16px] font-semibold text-[#F0F7F3] mb-2">2. That the call may be recorded</h2>
            <p>[Pending legal review]</p>
          </section>
          <section>
            <h2 className="text-[16px] font-semibold text-[#F0F7F3] mb-2">3. Calling hours</h2>
            <p>[Pending legal review]</p>
          </section>
          <section>
            <h2 className="text-[16px] font-semibold text-[#F0F7F3] mb-2">4. DND handling</h2>
            <p>[Pending legal review]</p>
          </section>
          <section>
            <h2 className="text-[16px] font-semibold text-[#F0F7F3] mb-2">5. Your responsibilities as a broker</h2>
            <p>[Pending legal review]</p>
          </section>
          <section>
            <h2 className="text-[16px] font-semibold text-[#F0F7F3] mb-2">6. Recording retention and deletion</h2>
            <p>[Pending legal review]</p>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * V2 (T11) — Proof dashboard: the same metric definitions the weekly report
 * uses, with a 12-week trend. "n/a" where a denominator is zero (never NaN).
 */
interface Metrics {
  leadsReceived: number;
  medianFirstCallSeconds: number | null;
  reachRate: number;
  qualifiedRate: number;
  visitsBooked: number;
  visitsCompleted: number;
  costPerCompletedVisit: number | "n/a";
}

interface Week extends Metrics {
  weekStart: string;
  weekEnd: string;
}

interface ProofResponse {
  current: Metrics;
  trend: Week[];
  definitions: Record<string, string>;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const secs = (n: number | null) => (n === null ? "n/a" : `${n}s`);

export default function ProofPage() {
  const [data, setData] = useState<ProofResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ProofResponse>("/client/proof")
      .then(setData)
      .catch((err) => setError(err?.response?.data?.error || "Could not load your proof metrics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-[#9FB0A6]">Loading proof metrics…</div>;
  if (error) return <div className="p-8 text-[#FB7185]">{error}</div>;
  if (!data) return null;

  const { current } = data;
  const cards = [
    { label: "Leads received", value: current.leadsReceived },
    { label: "Median first call", value: secs(current.medianFirstCallSeconds) },
    { label: "Reach rate", value: pct(current.reachRate) },
    { label: "Qualified rate", value: pct(current.qualifiedRate) },
    { label: "Visits booked", value: current.visitsBooked },
    { label: "Visits completed", value: current.visitsCompleted },
    {
      label: "Cost / completed visit",
      value: current.costPerCompletedVisit === "n/a" ? "n/a" : `₹${current.costPerCompletedVisit.toLocaleString("en-IN")}`,
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-[24px] font-display font-bold text-[#F0F7F3] mb-1">Proof</h1>
      <p className="text-[13px] text-[#9FB0A6] mb-8">
        The last 7 days, measured from your own leads. Every number below uses one fixed definition.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-wide text-[#6B7C73] mb-1">{c.label}</p>
            <p className="text-[22px] font-display font-bold text-[#F0F7F3]">{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-[15px] font-semibold text-[#F0F7F3] mb-3">12-week trend</h2>
      {data.trend.length === 0 ? (
        <p className="text-[13px] text-[#9FB0A6]">
          No weekly snapshots yet. The first one is generated Monday at 9 AM IST.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.04] text-[#9FB0A6]">
              <tr>
                <th className="px-3 py-2 font-medium">Week</th>
                <th className="px-3 py-2 font-medium">Leads</th>
                <th className="px-3 py-2 font-medium">Median call</th>
                <th className="px-3 py-2 font-medium">Reach</th>
                <th className="px-3 py-2 font-medium">Qualified</th>
                <th className="px-3 py-2 font-medium">Booked</th>
                <th className="px-3 py-2 font-medium">Visited</th>
                <th className="px-3 py-2 font-medium">Cost/visit</th>
              </tr>
            </thead>
            <tbody className="text-[#C9D6CF]">
              {data.trend.map((w) => (
                <tr key={w.weekStart} className="border-t border-white/[0.06]">
                  <td className="px-3 py-2">{new Date(w.weekStart).toLocaleDateString("en-IN")}</td>
                  <td className="px-3 py-2">{w.leadsReceived}</td>
                  <td className="px-3 py-2">{secs(w.medianFirstCallSeconds)}</td>
                  <td className="px-3 py-2">{pct(w.reachRate)}</td>
                  <td className="px-3 py-2">{pct(w.qualifiedRate)}</td>
                  <td className="px-3 py-2">{w.visitsBooked}</td>
                  <td className="px-3 py-2">{w.visitsCompleted}</td>
                  <td className="px-3 py-2">
                    {w.costPerCompletedVisit === null ? "n/a" : `₹${w.costPerCompletedVisit.toLocaleString("en-IN")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-[12px] font-semibold text-[#F0F7F3] mb-2">Definitions</h3>
        <ul className="space-y-1 text-[11px] text-[#6B7C73]">
          {Object.entries(data.definitions).map(([key, text]) => (
            <li key={key}><span className="text-[#9FB0A6]">{key}:</span> {text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

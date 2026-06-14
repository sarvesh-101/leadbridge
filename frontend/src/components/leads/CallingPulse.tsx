"use client";

/**
 * CallingPulse — the signature LeadBridge visual element.
 * Two sonar rings expand outward from the center dot when an AI call is live.
 */
export function CallingPulse({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dimensions = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  const containerSize = dimensions[size];

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: containerSize, height: containerSize }}
    >
      {/* Ring 1 */}
      <span className="absolute inset-0 rounded-full border border-[#4F6EF7] animate-sonar-ring" />
      {/* Ring 2 (offset by half-cycle) */}
      <span
        className="absolute inset-0 rounded-full border border-[#4F6EF7]"
        style={{ animation: "sonar-ring 1.5s ease-out infinite 0.75s" }}
      />
      {/* Center dot */}
      <span
        className="absolute rounded-full bg-[#4F6EF7]"
        style={{
          width: "40%",
          height: "40%",
        }}
      />
    </div>
  );
}

/**
 * Mini waveform for calling-status rows.
 * Three bars that animate up/down with staggered delays.
 */
export function CallingWaveform() {
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 14 }}>
      {[0, 0.15, 0.3].map((delay, i) => (
        <span
          key={i}
          className="w-[2px] bg-[#4F6EF7] rounded-full animate-waveform"
          style={{
            height: 4,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

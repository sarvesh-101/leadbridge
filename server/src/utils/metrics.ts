/**
 * V2 (T11) — minimal, dependency-free Prometheus metrics registry.
 *
 * The process exposes GET /metrics (see routes/metrics.ts). Keeping this tiny
 * avoids pulling a client library for five metrics. Counters are reset on
 * restart (Prometheus handles resets), histograms use fixed buckets.
 */

type Labels = Record<string, string>;

interface HistogramState {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, HistogramState>();

function key(name: string, labels?: Labels): string {
  if (!labels || Object.keys(labels).length === 0) return name;
  const inner = Object.entries(labels)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "'")}"`)
    .join(",");
  return `${name}{${inner}}`;
}

export function incCounter(name: string, labels?: Labels, by = 1): void {
  const k = key(name, labels);
  counters.set(k, (counters.get(k) ?? 0) + by);
}

export function setGauge(name: string, value: number, labels?: Labels): void {
  gauges.set(key(name, labels), value);
}

export function observeHistogram(name: string, value: number, buckets: number[], labels?: Labels): void {
  const k = key(name, labels);
  let state = histograms.get(k);
  if (!state) {
    state = { buckets, counts: buckets.map(() => 0), sum: 0, count: 0 };
    histograms.set(k, state);
  }
  state.sum += value;
  state.count += 1;
  for (let i = 0; i < buckets.length; i++) {
    if (value <= buckets[i]) state.counts[i] += 1;
  }
}

/** Record a lead's first-call delay (T5 definition) in seconds. */
export function observeFirstCallDelay(seconds: number): void {
  observeHistogram("lead_first_call_delay_seconds", seconds, [30, 60, 120, 300, 600, 1800, 3600]);
}

/** Record the outcome of an outbound call attempt. */
export function recordCallOutcome(answered: boolean): void {
  incCounter("call_attempts_total");
  if (answered) incCounter("call_answers_total");
}

export function recordBlockedOutsideWindow(): void {
  incCounter("calls_blocked_outside_window_total");
}

export function recordFairUseCapHit(): void {
  incCounter("fair_use_cap_hits_total");
}

export function recordDemoRequest(outcome: "requested" | "verified" | "rejected"): void {
  incCounter("demo_requests_total", { outcome });
}

export function renderMetrics(): string {
  const lines: string[] = [];

  for (const [k, v] of counters) lines.push(`${k} ${v}`);
  for (const [k, v] of gauges) lines.push(`${k} ${v}`);

  for (const [k, state] of histograms) {
    const name = k.split("{")[0];
    const suffix = k.includes("{") ? `{${k.slice(k.indexOf("{") + 1, -1)}}` : "";
    let cumulative = 0;
    for (let i = 0; i < state.buckets.length; i++) {
      cumulative = state.counts[i];
      const le = state.buckets[i];
      lines.push(`${name}_bucket${suffix ? suffix.replace("}", `,le="${le}"}`) : `{le="${le}"}`} ${cumulative}`);
    }
    lines.push(`${name}_bucket${suffix ? suffix.replace("}", `,le="+Inf"}`) : `{le="+Inf"}`} ${state.count}`);
    lines.push(`${name}_sum${suffix} ${state.sum}`);
    lines.push(`${name}_count${suffix} ${state.count}`);
  }

  // Answer rate — derived gauge, computed at scrape time.
  const attempts = [...counters.entries()]
    .filter(([k]) => k === "call_attempts_total")
    .reduce((sum, [, v]) => sum + v, 0);
  const answers = [...counters.entries()]
    .filter(([k]) => k === "call_answers_total")
    .reduce((sum, [, v]) => sum + v, 0);
  lines.push(`call_answer_rate ${attempts > 0 ? (answers / attempts).toFixed(4) : 0}`);

  return `${lines.join("\n")}\n`;
}

/** Test helper — clear all metrics between cases. */
export function resetMetrics(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
}

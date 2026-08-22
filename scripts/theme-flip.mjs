#!/usr/bin/env node
/**
 * Evergreen light-theme flip (2026-08-16)
 * Dark navy+blue → warm ivory + deep evergreen.
 * Applies to frontend/src TSX/CSS files (excluding marketing handled identically).
 *
 * Rules are deliberately explicit so the diff is reviewable.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const ROOT = join(process.cwd(), "frontend", "src");

// ── 1. Hex value swaps (order matters: longest/most-specific first) ──────────
const HEX_SWAPS = [
  // blue accent → deep evergreen (do before generic #3B82F6 siblings)
  ["#6B8AFF", "#2D6A4F"], // blue gradient partner → medium evergreen
  ["#3B82F6", "#1B4332"], // primary blue → deep evergreen
  // success emerald → AA emerald on light
  ["#10B981", "#047857"], // emerald → deep emerald (AA on white)
  // danger rose → AA rose on light
  ["#F43F5E", "#E11D48"], // rose → rose-600 (4.6:1 on white)
  // gold → AA gold on light
  ["#C9A84C", "#B8860B"], // gold → dark goldenrod (3.6:1)
  // amber → AA amber on light
  ["#F59E0B", "#B45309"], // amber-500 → amber-700
  // red → AA red
  ["#EF4444", "#DC2626"], // red-500 → red-600
  // backgrounds
  ["#0B0D12", "#FAF9F5"], // page bg → warm ivory
  ["#0a0a1a", "#FAF9F5"], // leftover dark bg → ivory
  ["#14161C", "#FFFFFF"], // card bg → white
  ["#1B1E26", "#F1F3EE"], // surface-2 / hover → light sage
  ["#16181F", "#FFFFFF"], // modal card → white
  ["#14141D", "#F1F3EE"], // card hover → light sage
  ["#272B34", "#E4E7DF"], // border → light sage border
  // text
  ["#F2F4F8", "#1E2B24"], // headings → deep evergreen ink
  ["#8B93A3", "#5C6B62"], // muted text → sage gray (AA)
  ["#363B45", "#8A948C"], // dim text/placeholder
  ["#3A3A52", "#8A948C"],
  ["#4A4A62", "#8A948C"],
  ["#A0A0C0", "#8A948C"],
  ["#4A4F59", "#7C8781"],
  ["#4B4B6A", "#7C8781"],
];

// ── 2. Pattern-class swaps (order matters) ───────────────────────────────────
const PATTERN_SWAPS = [
  // hover states first so base rules don't catch them
  ["hover:bg-white/10", "hover:bg-[#E9ECE5]"],
  ["hover:bg-white/5", "hover:bg-[#F1F3EE]"],
  ["hover:bg-white/20", "hover:bg-[#E9ECE5]"],
  ["bg-white/[0.07]", "bg-[#F1F3EE]"],
  ["bg-white/[0.06]", "bg-[#F7F8F4]"],
  ["bg-white/[0.05]", "bg-[#F7F8F4]"],
  ["bg-white/[0.03]", "bg-[#F7F8F4]"],
  ["bg-white/[0.02]", "bg-[#F7F8F4]"],
  ["bg-white/20", "bg-[#E9ECE5]"],
  ["bg-white/10", "bg-[#F1F3EE]"],
  ["bg-white/5", "bg-white"],
  // borders
  ["border-white/30", "border-[#D8DDD3]"],
  ["border-white/20", "border-[#D8DDD3]"],
  ["border-white/[0.06]", "border-[#E4E7DF]"],
  ["border-white/[0.03]", "border-[#EDF0EA]"],
  ["border-white/10", "border-[#E4E7DF]"],
  ["border-white/5", "border-[#EDF0EA]"],
  // gray text → evergreen-tinted grays (AA on light)
  ["text-gray-200", "text-[#5C6B62]"],
  ["text-gray-300", "text-[#5C6B62]"],
  ["text-gray-400", "text-[#7C8781]"],
  ["text-gray-500", "text-[#7C8781]"],
  // hover text grays
  ["hover:text-gray-200", "hover:text-[#1E2B24]"],
  ["hover:text-gray-300", "hover:text-[#1E2B24]"],
  ["hover:text-gray-400", "hover:text-[#1E2B24]"],
  ["hover:text-gray-500", "hover:text-[#1E2B24]"],
];

// ── 3. Dead leadflow-* classes → evergreen equivalents ───────────────────────
const LEADFLOW_SWAPS = [
  ["from-leadflow-500 to-leadflow-accent", "from-[#1B4332] to-[#2D6A4F]"],
  ["from-leadflow-500/20 to-leadflow-accent/20", "from-[#1B4332]/20 to-[#2D6A4F]/20"],
  ["from-leadflow-500/10 to-leadflow-accent/5", "from-[#1B4332]/10 to-[#2D6A4F]/5"],
  ["bg-leadflow-500/20", "bg-[#1B4332]/20"],
  ["bg-leadflow-500/10", "bg-[#1B4332]/10"],
  ["border-leadflow-500/30", "border-[#1B4332]/30"],
  ["border-leadflow-500/20", "border-[#1B4332]/20"],
  ["text-leadflow-accent", "text-[#2D6A4F]"],
  ["bg-leadflow-accent", "bg-[#2D6A4F]"],
  ["border-leadflow-accent", "border-[#2D6A4F]"],
  ["bg-gradient-to-r from-leadflow-500 to-leadflow-accent", "bg-gradient-to-r from-[#1B4332] to-[#2D6A4F]"],
];

// ── 4. text-white → text-ink, then revert to white on colored bgs ────────────
// Colored/dark backgrounds that keep white text.
const KEEP_WHITE_BG =
  /bg-\[#(1B4332|2D6A4F|047857|065F46|059669|E11D48|BE123C|B8860B|A16207|DC2626|B45309|7C3AED|DB2777|0891B2|4F46E5|0F766E|1E40AF|9333EA|C2410C)\]|bg-(red|emerald|green|blue|amber|rose|orange|violet|purple|indigo|cyan|teal|fuchsia|pink|yellow|black|stone)-[0-9]+|bg-gradient-to-[a-z]+/;

function isColoredBg(className) {
  return KEEP_WHITE_BG.test(className);
}

// ── walk files ───────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (extname(p) === ".tsx" || extname(p) === ".ts" || extname(p) === ".css") {
      out.push(p);
    }
  }
  return out;
}

function transform(file) {
  let src = readFileSync(file, "utf8");
  const original = src;

  // 1. Hex swaps
  for (const [from, to] of HEX_SWAPS) {
    src = src.split(from).join(to);
  }
  // 2. Pattern swaps
  for (const [from, to] of PATTERN_SWAPS) {
    src = src.split(from).join(to);
  }
  // 3. leadflow dead classes
  for (const [from, to] of LEADFLOW_SWAPS) {
    src = src.split(from).join(to);
  }
  // 3b. remaining bare leadflow-* (catch-all, before text-white pass)
  src = src
    .replace(/from-leadflow-500\b/g, "from-[#1B4332]")
    .replace(/to-leadflow-accent\b/g, "to-[#2D6A4F]")
    .replace(/bg-leadflow-500\b/g, "bg-[#1B4332]")
    .replace(/text-leadflow-accent\b/g, "text-[#2D6A4F]");

  // 4. text-white context pass
  const lines = src.split("\n");
  let prevColored = false;
  const outLines = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Track whether this line's element (or the one just opened on the PREVIOUS
    // line — the child-icon case) sits on a colored background.
    let thisLineColored = false;

    if (line.includes("text-white")) {
      // Same-line: element has its own colored bg → keep white.
      // Also catch the child-icon case: previous line opened a colored-bg element.
      if (isColoredBg(line) || prevColored) {
        thisLineColored = true;
        line = line.split("text-white").join("text-white");
      } else {
        line = line.split("text-white").join("text-ink");
      }
    }
    // text-white/xx opacity variants
    if (line.includes("text-white/")) {
      if (isColoredBg(line) || prevColored) {
        line = line.replace(/text-white\/\d+/g, "text-white");
      } else {
        line = line.replace(/text-white\/\d+/g, "text-ink");
      }
    }

    // Determine colored-bg state for the NEXT line: if this line opens an
    // element with a colored bg (has a bg class and doesn't close itself), the
    // next line is likely its child icon.
    const trimmed = line.trim();
    const opensColored =
      isColoredBg(line) &&
      !trimmed.includes("/>") &&
      (trimmed.includes("className=") || /<[A-Za-z]/.test(trimmed));

    // Reset prevColored: an icon child only applies to the immediate next line,
    // and only if this line didn't already close the colored element.
    prevColored = opensColored;

    outLines.push(line);
  }
  src = outLines.join("\n");

  if (src !== original) {
    writeFileSync(file, src);
    return true;
  }
  return false;
}

let changed = 0;
for (const f of walk(ROOT)) {
  if (transform(f)) changed++;
}
console.log(`Theme flip applied to ${changed} files.`);

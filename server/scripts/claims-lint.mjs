#!/usr/bin/env node
/**
 * V2 (T9) — claims lint.
 *
 * Scans customer-facing trees for banned phrases (unsourced claims, retired
 * wording, internal brand leakage) and exits 1 on any hit. The banned list is
 * human-editable in claims-lint.config.json — extend it, never inline it.
 *
 * Usage (from repo root or server/):
 *   node scripts/claims-lint.mjs
 *   node scripts/claims-lint.mjs --verbose
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const CONFIG_PATH = path.join(HERE, "claims-lint.config.json");

const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".html", ".txt"]);
const DEFAULT_TARGETS = [
  "frontend/src",
  "server/src/ai/prompts",
  "server/src/services/template.service.ts",
];
const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git"]);

export function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

/** Return [{ index, phrase }] for every banned phrase present in `text`. */
// A banned phrase is silenceable in-copy only when the whole sentence exists to
// disallow the claim, not merely to name the banned list. We do not silence hits
// that reference the policy generically ("we ban 24/7 calling") unless the same
// sentence also actively disclaims the claim.
export function isThisPhraseOnlyDisallowedInThisLocation(text, index, phrase) {
  if (index === -1) return false;
  const start = Math.max(0, index - 120);
  const context = text.slice(start, index + phrase.length + 120);
  return (
    /no\s+(unsourced|guarantee|promise|24\/7 calling|outcome|published result|result)\b/i.test(context) &&
    /claim|copy|outcomes?|result/i.test(context)
  );
}

export function findViolations(text, config = loadConfig()) {
  const lower = text.toLowerCase();
  const hits = [];
  const inCopyOnly = new Set((config.inCopyOnly || []).map((p) => p.toLowerCase()));
  for (const entry of config.banned) {
    const phrase = typeof entry === "string" ? entry : entry.phrase;
    if (!lower.includes(phrase.toLowerCase())) continue;

    let from = 0;
    for (;;) {
      const index = lower.indexOf(phrase.toLowerCase(), from);
      if (index === -1) break;

      // A claim can be disproven in-copy by the permitted formulation (the 24/7
      // lead-capture sentence). Beyond that, only silence a hit when the claim is
      // only present to disallow itself in a comment.
      let silenceable = false;
      if (typeof entry === "object" && entry.allow) {
        const allow = new RegExp(entry.allow, "i");
        const stripped = text.replace(allow, "");
        if (!stripped.toLowerCase().includes(phrase.toLowerCase())) {
          silenceable = true;
        }
      }
      if (!silenceable && inCopyOnly.has(phrase.toLowerCase())) {
        if (isThisPhraseOnlyDisallowedInThisLocation(text, index, phrase)) {
          silenceable = true;
        }
      }

      if (!silenceable) {
        hits.push({ index, phrase });
      }
      from = index + phrase.length;
    }
  }
  return hits;
}

function walk(target, files = []) {
  if (!existsSync(target)) return files;
  const stat = statSync(target);
  if (stat.isFile()) {
    if (EXTENSIONS.has(path.extname(target))) files.push(target);
    return files;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    walk(path.join(target, entry.name), files);
  }
  return files;
}

export function scan(targets = DEFAULT_TARGETS, root = REPO_ROOT, config = loadConfig()) {
  const findings = [];
  for (const target of targets) {
    for (const file of walk(path.resolve(root, target))) {
      const text = readFileSync(file, "utf8");
      for (const hit of findViolations(text, config)) {
        const before = text.slice(0, hit.index);
        const line = before.split("\n").length;
        findings.push({ file: path.relative(root, file), line, phrase: hit.phrase });
      }
    }
  }
  return findings;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const config = loadConfig();
  const findings = scan(config.scan, REPO_ROOT, config);
  if (findings.length === 0) {
    console.log(`✅ claims-lint: 0 banned phrases in ${config.scan.join(", ")}`);
    process.exit(0);
  }
  console.error(`❌ claims-lint: ${findings.length} banned phrase(s) found\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  →  "${f.phrase}"`);
  process.exit(1);
}

/** Readable one-line summary of one violation (for tests and CI output). */
export function summarize(violation) {
  const { file, line, phrase } = violation;
  return `${file}:${line}  →  "${phrase}"`;
}

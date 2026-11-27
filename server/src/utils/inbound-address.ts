/**
 * Per-broker inbound email addresses — `<mailbox>+<token>@<domain>`.
 *
 * Why this exists: a Gmail/portal **auto-forward rule preserves the original
 * `From` header** (the portal's own address, e.g. no-reply@magicbricks.com), so
 * matching a forwarded email by sender only works when the broker forwards by
 * hand. The *recipient* address does survive auto-forwarding (it appears in
 * Delivered-To / X-Forwarded-To / To), so a unique address per broker is the
 * reliable routing key.
 *
 * The address is a **plus-address on the mailbox the platform actually polls**
 * (IMAP_USER, else the shared FORWARDING_EMAIL). That matters: `leads+tok@…`
 * looks fine but only delivers if a mailbox named `leads@` exists, and nobody
 * ever creates it — so the broker's address would silently bounce. A
 * plus-address always lands in the polled inbox, so one poller serves every
 * broker and the token in `Delivered-To` says whose mail it was.
 *
 * Sender matching stays as a fallback, which keeps manual forwards and the
 * legacy shared FORWARDING_EMAIL mailbox working unchanged.
 */
import type { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";

// No 0/o/1/l — brokers read and type these addresses by hand.
const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const TOKEN_LENGTH = 10;
const FALLBACK_PREFIX = "leads";
// Prefixes handed out by earlier builds; keep matching them so addresses a
// broker already configured never stop routing.
const LEGACY_PREFIXES = ["leads"];

export const generateInboundToken = customAlphabet(TOKEN_ALPHABET, TOKEN_LENGTH);

function splitAddress(value: string): { local: string; domain: string } | null {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return null;
  // Strip an existing plus-tag so `<user>+old@` still yields `<user>`.
  return { local: trimmed.slice(0, at).split("+")[0], domain: trimmed.slice(at + 1) };
}

/**
 * The mailbox that is actually polled: IMAP_USER when the IMAP poller is
 * configured (that is the only way the platform reads mail today), otherwise
 * FORWARDING_EMAIL for webhook-only setups.
 */
function baseMailbox(): { local: string; domain: string } | null {
  return splitAddress(process.env.IMAP_USER || "") || splitAddress(process.env.FORWARDING_EMAIL || "");
}

export function forwardingPrefix(): string {
  const base = baseMailbox();
  const local = (base?.local || FALLBACK_PREFIX).replace(/[^a-z0-9._-]/g, "");
  return local || FALLBACK_PREFIX;
}

/**
 * Domain for per-broker addresses: `FORWARDING_DOMAIN` if set (a dedicated
 * catch-all such as forward.converza.tech), otherwise the polled mailbox's own
 * domain — which is what makes the plus-address deliverable with no DNS work.
 */
export function forwardingDomain(): string {
  const explicit = (process.env.FORWARDING_DOMAIN || "").trim().toLowerCase();
  if (explicit) return explicit;
  return baseMailbox()?.domain || "converza.tech";
}

export function buildInboundAddress(token: string): string {
  return `${forwardingPrefix()}+${token}@${forwardingDomain()}`;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Flatten whatever a provider hands us into address payloads. SendGrid posts
 * `envelope` as an object, CloudMailin/Mailgun as a JSON string, others as
 * arrays — all of them carry the recipient we route on, so none may crash us.
 */
function flattenAddresses(value: unknown, out: string[], depth = 0): void {
  if (value == null || depth > 4) return;
  if (typeof value === "string") {
    if (value) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) flattenAddresses(entry, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      flattenAddresses(entry, out, depth + 1);
    }
  }
}

function tokenRegex(): RegExp {
  const prefixes = Array.from(new Set([forwardingPrefix(), ...LEGACY_PREFIXES])).map(escapeRe);
  return new RegExp(`\\b(?:${prefixes.join("|")})\\+([a-z0-9]{6,32})@`, "i");
}

/**
 * Find a broker token in any address-bearing strings we can see (To, Cc,
 * Delivered-To, X-Forwarded-To, raw header block). Returns the first match.
 */
export function extractInboundToken(candidates: unknown[]): string | null {
  const re = tokenRegex();
  const addressText: string[] = [];
  for (const candidate of candidates) flattenAddresses(candidate, addressText);
  for (const chunk of addressText) {
    const match = chunk.match(re);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/**
 * Return the broker's inbound token, allocating one on first use. Existing
 * clients predate the token, so this must stay lazy rather than a backfill.
 */
export async function ensureInboundToken(prisma: PrismaClient, clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { inboundToken: true },
  });
  if (!client) throw new Error("Client not found");
  if (client.inboundToken) return client.inboundToken;

  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateInboundToken();
    try {
      const updated = await prisma.client.update({
        where: { id: clientId },
        data: { inboundToken: token },
        select: { inboundToken: true },
      });
      // Re-read: a concurrent request may have won the race, and the address we
      // hand back must be the one the lookup will actually resolve.
      const persisted = await prisma.client.findUnique({
        where: { id: clientId },
        select: { inboundToken: true },
      });
      return persisted?.inboundToken || updated.inboundToken || token;
    } catch (err) {
      // P2002 = unique collision on inboundToken → try another token.
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }
  throw new Error("Could not allocate an inbound token");
}

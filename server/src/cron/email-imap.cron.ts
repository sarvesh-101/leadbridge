/**
 * IMAP email ingestion — polls a mailbox for forwarded portal emails.
 *
 * Every 2 minutes (when IMAP_HOST / IMAP_USER / IMAP_PASS are configured) this
 * connects to the mailbox, reads UNSEEN messages, runs them through the shared
 * email-ingestion pipeline (broker lookup → parse → dedup → AI call), and
 * marks them \Seen. A message that throws is left unread so the next cycle
 * retries it.
 *
 * This makes email forwarding work with ANY mailbox the platform already owns
 * (e.g. forward@converza.tech, or a Gmail inbox with an app password) — no
 * SendGrid/Mailgun/CloudMailin signup needed.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { config } from "../config";
import { logger } from "../utils/logger";
import { processForwardedEmail } from "../services/email-ingestion.service";

const MAX_MESSAGES_PER_CYCLE = 50;

export async function runImapEmailPull(): Promise<{
  configured: boolean;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
}> {
  if (!config.IMAP_HOST || !config.IMAP_USER || !config.IMAP_PASS) {
    return { configured: false, processed: 0, created: 0, skipped: 0, errors: 0 };
  }

  const client = new ImapFlow({
    host: config.IMAP_HOST,
    port: config.IMAP_PORT,
    secure: config.IMAP_TLS,
    auth: { user: config.IMAP_USER, pass: config.IMAP_PASS },
    logger: false,
  });

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  try {
    await client.connect();
    await client.mailboxOpen(config.IMAP_FOLDER);
    const searchResult = await client.search({ seen: false }, { uid: true }); // seen:false = unseen
    const uids = searchResult === false ? [] : searchResult;
    const batch = uids.slice(-MAX_MESSAGES_PER_CYCLE);

    const { prisma } = await import("../utils/prisma-shared");
    // Minimal ctx — the pipeline only needs prisma (+ redis for the dedup lock,
    // which gracefully degrades when null, matching the app-wide convention).
    const ctx = { prisma, redis: null } as never;

    for (const uid of batch) {
      try {
        const message = await client.fetchOne(uid, { source: true, envelope: true });
        if (!message || !message.source) continue;
        const parsed = await simpleParser(message.source);
        const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase() || "";
        const text = parsed.text || parsed.textAsHtml?.replace(/<[^>]+>/g, "") || "";

        const result = await processForwardedEmail(ctx, {
          from: fromEmail,
          subject: parsed.subject || undefined,
          text: text.slice(0, 10000),
          meta: { provider: "imap", messageId: parsed.messageId || undefined, folder: config.IMAP_FOLDER },
        });

        processed++;
        if (result.status === "created") created++;
        else skipped++;

        // Handled → mark seen so we never reprocess (dedup + seen flag).
        await client.messageFlagsAdd(uid, ["\\Seen"]);
      } catch (err: any) {
        errors++;
        logger.warn({ uid, err: err.message }, "IMAP email processing failed — leaving unread for retry");
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "IMAP email pull failed");
  } finally {
    await client.logout().catch(() => {});
  }

  if (processed > 0 || errors > 0) {
    logger.info({ processed, created, skipped, errors, folder: config.IMAP_FOLDER }, "IMAP email pull cycle complete");
  }

  return { configured: true, processed, created, skipped, errors };
}
/**
 * Revenue Recognition Cron — runs daily at 2:00 AM.
 *
 * FIX #5 (GAAP compliance): Spreads revenue across billing period.
 * For each deferred AccountingEntry:
 *   1. Calculate days since last recognition (or periodStart).
 *   2. Recognize revenue at dailyRate for those days.
 *   3. Mark fully recognized when daysRecognized >= totalDays.
 *
 * Also: Creates AccountingEntry for newly paid invoices that don't have one.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../utils/logger";

export async function runRevenueRecognition(prisma: PrismaClient) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  logger.info("Starting daily revenue recognition...");

  // ─── Step 1: Create AccountingEntries for paid invoices without one ──
  const paidInvoicesWithoutEntry = await prisma.invoice.findMany({
    where: {
      status: "PAID",
      accountingEntries: { none: {} },
      totalAmount: { gt: 0 },
    },
    include: {
      subscription: { select: { startDate: true, endDate: true } },
    },
  });

  let entriesCreated = 0;
  for (const invoice of paidInvoicesWithoutEntry) {
    const periodStart = invoice.periodStart || invoice.subscription?.startDate || invoice.issueDate;
    const periodEnd = invoice.periodEnd || invoice.subscription?.endDate || invoice.dueDate;
    const totalDays = Math.max(1, Math.round(
      (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
    ));

    await prisma.accountingEntry.create({
      data: {
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        type: "subscription_revenue",
        status: "DEFERRED",
        description: `Deferred revenue: ${invoice.description || invoice.invoiceNumber}`,
        amount: invoice.totalAmount,
        recognizedAmount: 0,
        deferredAmount: invoice.totalAmount,
        periodStart,
        periodEnd,
        totalDays,
        dailyRate: Math.round((invoice.totalAmount / totalDays) * 100) / 100,
        daysRecognized: 0,
      },
    });
    entriesCreated++;
  }

  if (entriesCreated > 0) {
    logger.info({ entriesCreated }, "Created accounting entries for newly paid invoices");
  }

  // ─── Step 2: Recognize revenue for deferred entries ─────────────────
  const deferredEntries = await prisma.accountingEntry.findMany({
    where: {
      status: "DEFERRED",
      deferredAmount: { gt: 0 },
    },
    orderBy: { periodStart: "asc" },
  });

  let totalRecognized = 0;
  let entriesCompleted = 0;

  for (const entry of deferredEntries) {
    // Calculate days elapsed since last recognition
    const lastRecognition = entry.lastRecognizedAt || entry.periodStart;
    const daysSinceLast = Math.max(0, Math.round(
      (today.getTime() - lastRecognition.getTime()) / (1000 * 60 * 60 * 24)
    ));

    if (daysSinceLast === 0) continue;

    // Don't recognize more days than remaining
    const daysRemaining = entry.totalDays - entry.daysRecognized;
    const daysToRecognize = Math.min(daysSinceLast, daysRemaining);

    if (daysToRecognize <= 0) continue;

    const amountToRecognize = Math.round(entry.dailyRate * daysToRecognize * 100) / 100;
    const newRecognized = entry.recognizedAmount + amountToRecognize;
    const newDeferred = Math.max(0, entry.amount - newRecognized);

    // Edge case: avoid rounding errors exceeding the total
    const finalRecognized = Math.min(newRecognized, entry.amount);
    const finalDeferred = Math.max(0, entry.amount - finalRecognized);

    const isFullyRecognized = finalDeferred <= 0 || (entry.daysRecognized + daysToRecognize) >= entry.totalDays;

    await prisma.accountingEntry.update({
      where: { id: entry.id },
      data: {
        recognizedAmount: isFullyRecognized ? entry.amount : finalRecognized,
        deferredAmount: isFullyRecognized ? 0 : finalDeferred,
        daysRecognized: Math.min(entry.daysRecognized + daysToRecognize, entry.totalDays),
        lastRecognizedAt: today,
        status: isFullyRecognized ? "RECOGNIZED" : "DEFERRED",
        fullyRecognizedAt: isFullyRecognized ? today : undefined,
      },
    });

    totalRecognized += amountToRecognize;
    if (isFullyRecognized) entriesCompleted++;

    logger.info(
      {
        entryId: entry.id,
        amountRecognized: amountToRecognize,
        daysRecognized: daysToRecognize,
        isFullyRecognized,
      },
      "Revenue recognized for accounting entry"
    );
  }

  // ─── Step 3: Create credit note accounting entries for refunded invoices ──
  const refundedInvoicesWithoutEntry = await prisma.invoice.findMany({
    where: {
      status: "REFUNDED",
      accountingEntries: {
        every: { status: { not: "REVERSED" } },
      },
    },
  });

  let reversalsCreated = 0;
  for (const invoice of refundedInvoicesWithoutEntry) {
    // Find the original deferred entry
    const originalEntry = await prisma.accountingEntry.findFirst({
      where: { invoiceId: invoice.id, type: "subscription_revenue" },
    });

    if (originalEntry && originalEntry.recognizedAmount > 0) {
      // Reverse whatever was recognized
      await prisma.accountingEntry.update({
        where: { id: originalEntry.id },
        data: {
          status: "REVERSED",
          reversedAt: new Date(),
          reversalReason: `Invoice ${invoice.invoiceNumber} refunded`,
        },
      });
      reversalsCreated++;
    }
  }

  if (reversalsCreated > 0) {
    logger.info({ reversalsCreated }, "Reversed accounting entries for refunded invoices");
  }

  logger.info({
    entriesProcessed: deferredEntries.length,
    totalRecognized: Math.round(totalRecognized * 100) / 100,
    entriesCompleted,
    reversalsCreated,
  }, "Daily revenue recognition complete");

  return {
    entriesCreated,
    entriesProcessed: deferredEntries.length,
    totalRecognized: Math.round(totalRecognized * 100) / 100,
    entriesCompleted,
    reversalsCreated,
  };
}

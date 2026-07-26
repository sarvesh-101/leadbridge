/**
 * Data Cleanup Cron — runs weekly on Sunday at 2:00 AM.
 *
 * Prevents database bloat by archiving/stale data:
 * - Leads older than 6 months in COLD or CONVERTED state → archive
 * - Calls older than 3 months → delete (transcript/summary preserved in lead)
 * - Customer/Owner notifications older than 6 months → delete
 * - Orphaned bookings (no lead linked) → delete
 */

import { prisma } from "../utils/prisma-shared";
import { logger } from "../utils/logger";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000;

export async function runDataCleanup(): Promise<{
  archivedLeads: number;
  deletedCalls: number;
  deletedNotifications: number;
  deletedOrphanBookings: number;
  archivedAuditLogs: number;
}> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - SIX_MONTHS_MS);
  const threeMonthsAgo = new Date(now.getTime() - THREE_MONTHS_MS);

  logger.info({ sixMonthsAgo, threeMonthsAgo }, "Data cleanup: Starting cleanup cycle");

  // 1. Archive old terminal-state leads (COLD / CONVERTED older than 6 months)
  // We don't delete them — we just mark the existing rawPayload with an archived flag.
  // First fetch leads, then merge archived flag into existing rawPayload to avoid data loss.
  const oldLeads = await prisma.lead.findMany({
    where: {
      status: { in: ["COLD", "CONVERTED"] },
      updatedAt: { lte: sixMonthsAgo },
      createdAt: { lte: sixMonthsAgo },
    },
    select: { id: true, rawPayload: true },
  });

  let archivedCount = 0;
  for (const lead of oldLeads) {
    const existingPayload = (lead.rawPayload as Record<string, unknown>) || {};
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        rawPayload: {
          ...existingPayload,
          archived: true,
          archivedAt: now.toISOString(),
        },
      },
    });
    archivedCount++;
  }

  // 2. Delete old call records (older than 3 months)
  // The transcript/summary is preserved as String fields — we just delete the row
  const deletedCalls = await prisma.call.deleteMany({
    where: {
      createdAt: { lte: threeMonthsAgo },
    },
  });

  // 3. Delete old notifications (older than 6 months)
  const deletedCustomerNotifs = await prisma.customerNotification.deleteMany({
    where: {
      sentAt: { lte: sixMonthsAgo },
    },
  });
  const deletedOwnerNotifs = await prisma.ownerNotification.deleteMany({
    where: {
      sentAt: { lte: sixMonthsAgo },
    },
  });

  // 4. Delete orphaned bookings (no lead associated)
  const deletedOrphanBookings = await prisma.booking.deleteMany({
    where: {
      lead: null,
      createdAt: { lte: threeMonthsAgo },
    },
  });

  // 5. Archive old audit logs (older than 6 months)
  // Instead of DELETING (which destroys compliance data), we mark them
  // as archived in the metadata field. The data stays in the database
  // but is excluded from regular queries by the archived flag.
  // For heavy compliance needs, this could later export to S3/Blob storage.
  const oldAuditLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: { lte: sixMonthsAgo },
    },
    select: { id: true, metadata: true },
  });

  let archivedAuditLogs = 0;
  for (const log of oldAuditLogs) {
    const existingMetadata = (log.metadata as Record<string, unknown>) || {};
    await prisma.auditLog.update({
      where: { id: log.id },
      data: {
        metadata: {
          ...existingMetadata,
          archived: true,
          archivedAt: now.toISOString(),
        },
      },
    });
    archivedAuditLogs++;
  }

  const totalNotifications = deletedCustomerNotifs.count + deletedOwnerNotifs.count;

  logger.info(
    {
      archivedLeads: archivedCount,
      deletedCalls: deletedCalls.count,
      deletedNotifications: totalNotifications,
      deletedOrphanBookings: deletedOrphanBookings.count,
      archivedAuditLogs,
    },
    "Data cleanup: Cycle complete"
  );

  return {
    archivedLeads: archivedCount,
    deletedCalls: deletedCalls.count,
    deletedNotifications: totalNotifications,
    deletedOrphanBookings: deletedOrphanBookings.count,
    archivedAuditLogs,
  };
}

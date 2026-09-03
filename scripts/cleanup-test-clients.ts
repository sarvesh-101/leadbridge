/**
 * Cleanup Demo/Test Clients — run before launch to remove non-production data.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-clients.ts [--dry-run]
 *
 * Requires DATABASE_URL in environment or server/.env
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// Load .env from server directory
const envPath = path.resolve(__dirname, "../server/.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const DRY_RUN = process.argv.includes("--dry-run");

// Test/demo client business names to remove
const TEST_BUSINESS_NAMES = [
  "Demo Real Estate",
  "Prime Realty",
  "Test Realty",
  "GsTechno",
  "GsTechno Telecom",
];

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find test/demo clients
    const testClients = await prisma.client.findMany({
      where: {
        OR: TEST_BUSINESS_NAMES.map((name) => ({
          businessName: { contains: name, mode: "insensitive" as const },
        })),
      },
      select: {
        id: true,
        businessName: true,
        email: true,
        plan: true,
        planStatus: true,
        city: true,
        _count: {
          select: {
            leads: true,
            calls: true,
            bookings: true,
          },
        },
      },
    });

    if (testClients.length === 0) {
      console.log("✅ No test/demo clients found in database.");
      return;
    }

    console.log(`\nFound ${testClients.length} test/demo client(s):\n`);
    for (const c of testClients) {
      console.log(
        `  - ${c.businessName} (${c.email}) | plan=${c.plan} status=${c.planStatus} city=${c.city} | leads=${c._count.leads} calls=${c._count.calls} bookings=${c._count.bookings}`
      );
    }

    if (DRY_RUN) {
      console.log("\n🔍 DRY RUN — no changes made. Remove --dry-run to execute.");
      return;
    }

    console.log("\n⚠️  This will permanently delete these clients and all their data.");
    console.log("    Press Ctrl+C within 5 seconds to abort...\n");
    await new Promise((r) => setTimeout(r, 5000));

    for (const client of testClients) {
      console.log(`🗑️  Deleting ${client.businessName} (${client.id})...`);

      // Delete in order of foreign key dependencies
      await prisma.ownerNotification.deleteMany({ where: { clientId: client.id } });
      await prisma.leadNote.deleteMany({ where: { lead: { clientId: client.id } } });
      await prisma.lead.deleteMany({ where: { clientId: client.id } });
      await prisma.booking.deleteMany({ where: { clientId: client.id } });
      await prisma.callLog.deleteMany({ where: { clientId: client.id } });
      await prisma.campaign.deleteMany({ where: { clientId: client.id } });
      await prisma.message.deleteMany({ where: { clientId: client.id } });
      await prisma.webhookSource.deleteMany({ where: { clientId: client.id } });
      await prisma.teamMember.deleteMany({ where: { clientId: client.id } });
      await prisma.territory.updateMany({ where: { clientId: client.id }, data: { clientId: null, locked: false } });
      await prisma.client.delete({ where: { id: client.id } });

      console.log(`   ✅ Deleted ${client.businessName}`);
    }

    console.log(`\n✅ Cleaned up ${testClients.length} test/demo client(s).`);
  } catch (err: any) {
    console.error("❌ Cleanup failed:", err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

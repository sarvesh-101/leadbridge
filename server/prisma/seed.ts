/**
 * LeadBridge — Database Seed Script
 *
 * Usage:
 *   npx prisma db seed
 *
 * This script populates:
 *   1. Default admin account
 *   2. Indian territories (top 50+ cities with tier-based pricing)
 *   3. Demo client with sample leads, calls, bookings
 *   4. Subscription plans and pricing
 *
 * Run only in development/staging:
 *   npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── 1. Admin ─────────────────────────────────────────────
  const adminEmail = "admin@leadbridge.com";
  const adminPassword = await bcrypt.hash("admin123!A", 12);

  const admin = await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPassword,
      name: "Platform Admin",
    },
  });
  console.log(`✅ Admin created: ${admin.email} (password: admin123!A)`);

  // ─── 2. Territories (Top 50+ Indian cities) ─────────────
  interface TerritorySeed {
    city: string;
    zone: string | null;
    tier: number;
  }

  const territories: TerritorySeed[] = [
    // Tier 1 — Metro cities (highest price)
    { city: "Mumbai", zone: null, tier: 1 },
    { city: "Mumbai", zone: "South Mumbai", tier: 1 },
    { city: "Mumbai", zone: "Western Suburbs", tier: 1 },
    { city: "Mumbai", zone: "Navi Mumbai", tier: 1 },
    { city: "Mumbai", zone: "Thane", tier: 1 },
    { city: "Delhi", zone: null, tier: 1 },
    { city: "Delhi", zone: "South Delhi", tier: 1 },
    { city: "Delhi", zone: "North Delhi", tier: 1 },
    { city: "Delhi", zone: "East Delhi", tier: 1 },
    { city: "Delhi", zone: "West Delhi", tier: 1 },
    { city: "Delhi", zone: "Central Delhi", tier: 1 },
    { city: "Bangalore", zone: null, tier: 1 },
    { city: "Bangalore", zone: "Whitefield", tier: 1 },
    { city: "Bangalore", zone: "Electronic City", tier: 1 },
    { city: "Bangalore", zone: "Hebbal", tier: 1 },
    { city: "Hyderabad", zone: null, tier: 1 },
    { city: "Hyderabad", zone: "HITEC City", tier: 1 },
    { city: "Hyderabad", zone: "Gachibowli", tier: 1 },
    { city: "Chennai", zone: null, tier: 1 },
    { city: "Chennai", zone: "OMR", tier: 1 },
    { city: "Kolkata", zone: null, tier: 1 },

    // Tier 2 — Major cities
    { city: "Ahmedabad", zone: null, tier: 2 },
    { city: "Ahmedabad", zone: "SG Highway", tier: 2 },
    { city: "Pune", zone: null, tier: 2 },
    { city: "Pune", zone: "Hinjewadi", tier: 2 },
    { city: "Pune", zone: "Koregaon Park", tier: 2 },
    { city: "Jaipur", zone: null, tier: 2 },
    { city: "Lucknow", zone: null, tier: 2 },
    { city: "Surat", zone: null, tier: 2 },
    { city: "Chandigarh", zone: null, tier: 2 },
    { city: "Bhopal", zone: null, tier: 2 },
    { city: "Indore", zone: null, tier: 2 },
    { city: "Nagpur", zone: null, tier: 2 },
    { city: "Kochi", zone: null, tier: 2 },
    { city: "Coimbatore", zone: null, tier: 2 },
    { city: "Visakhapatnam", zone: null, tier: 2 },
    { city: "Vadodara", zone: null, tier: 2 },
    { city: "Thiruvananthapuram", zone: null, tier: 2 },
    { city: "Guwahati", zone: null, tier: 2 },

    // Tier 3 — Growing cities (budget-friendly)
    { city: "Agra", zone: null, tier: 3 },
    { city: "Ajmer", zone: null, tier: 3 },
    { city: "Allahabad", zone: null, tier: 3 },
    { city: "Amritsar", zone: null, tier: 3 },
    { city: "Aurangabad", zone: null, tier: 3 },
    { city: "Bhubaneswar", zone: null, tier: 3 },
    { city: "Dehradun", zone: null, tier: 3 },
    { city: "Faridabad", zone: null, tier: 3 },
    { city: "Ghaziabad", zone: null, tier: 3 },
    { city: "Goa", zone: null, tier: 3 },
    { city: "Gurgaon", zone: null, tier: 3 },
    { city: "Gwalior", zone: null, tier: 3 },
    { city: "Jabalpur", zone: null, tier: 3 },
    { city: "Jalandhar", zone: null, tier: 3 },
    { city: "Jammu", zone: null, tier: 3 },
    { city: "Jodhpur", zone: null, tier: 3 },
    { city: "Kanpur", zone: null, tier: 3 },
    { city: "Kolhapur", zone: null, tier: 3 },
    { city: "Kota", zone: null, tier: 3 },
    { city: "Ludhiana", zone: null, tier: 3 },
    { city: "Madurai", zone: null, tier: 3 },
    { city: "Mangalore", zone: null, tier: 3 },
    { city: "Meerut", zone: null, tier: 3 },
    { city: "Mysore", zone: null, tier: 3 },
    { city: "Nashik", zone: null, tier: 3 },
    { city: "Noida", zone: null, tier: 3 },
    { city: "Patna", zone: null, tier: 3 },
    { city: "Rajkot", zone: null, tier: 3 },
    { city: "Ranchi", zone: null, tier: 3 },
    { city: "Salem", zone: null, tier: 3 },
    { city: "Shimla", zone: null, tier: 3 },
    { city: "Srinagar", zone: null, tier: 3 },
    { city: "Tiruchirappalli", zone: null, tier: 3 },
    { city: "Tirunelveli", zone: null, tier: 3 },
    { city: "Udaipur", zone: null, tier: 3 },
    { city: "Varanasi", zone: null, tier: 3 },
    { city: "Vijayawada", zone: null, tier: 3 },
    { city: "Warangal", zone: null, tier: 3 },
  ];

  let territoryCount = 0;
  for (const t of territories) {
    await prisma.territory.upsert({
      where: { city_zone: { city: t.city, zone: t.zone } },
      update: { tier: t.tier },
      create: {
        city: t.city,
        zone: t.zone,
        tier: t.tier,
        locked: false,
      },
    });
    territoryCount++;
  }
  console.log(`✅ ${territoryCount} territories seeded`);

  // ─── 3. Demo Client ──────────────────────────────────────
  const clientEmail = "demo@broker.com";
  const clientPassword = await bcrypt.hash("demo123!A", 12);

  const client = await prisma.client.upsert({
    where: { email: clientEmail },
    update: {},
    create: {
      businessName: "Demo Real Estate",
      ownerName: "Rajesh Kumar",
      email: clientEmail,
      phone: "+919999988888",
      city: "Mumbai",
      zone: "Western Suburbs",
      passwordHash: clientPassword,
      ownerWhatsapp: "+919999988888",
      language: "hinglish",
      plan: "GROWTH",
      planStatus: "ACTIVE",
      callsLimit: 300,
      onboardingComplete: true,
      onboardingStep: 7,
      adminId: admin.id,
      // Assign a territory
      territory: {
        connectOrCreate: {
          where: { city_zone: { city: "Mumbai", zone: "Western Suburbs" } },
          create: { city: "Mumbai", zone: "Western Suburbs", tier: 1 },
        },
      },
    },
  });
  console.log(`✅ Demo client: ${client.email} (password: demo123!A)`);

  // ─── 4. Sample Leads ─────────────────────────────────────
  const sampleLeads = [
    { name: "Amit Sharma", phone: "+919876543210", source: "99acres", budget: "80L-1.2Cr", location: "Andheri West", timeline: "2-3 months", status: "PENDING" as const },
    { name: "Priya Patel", phone: "+919876543211", source: "MagicBricks", budget: "1.5Cr-2Cr", location: "Bandra East", timeline: "1 month", status: "BOOKED" as const },
    { name: "Suresh Reddy", phone: "+919876543212", source: "Housing.com", budget: "60L-90L", location: "Malad West", timeline: "Immediate", status: "CONVERTED" as const },
    { name: "Neha Singh", phone: "+919876543213", source: "JustDial", budget: "40L-60L", location: "Dadar", timeline: "3-4 months", status: "COLD" as const },
    { name: "Vikram Joshi", phone: "+919876543214", source: "Facebook", budget: "1Cr-1.5Cr", location: "Powai", timeline: "2 weeks", status: "CALLING" as const },
    { name: "Ananya Gupta", phone: "+919876543215", source: "Google", budget: "2Cr-3Cr", location: "Juhu", timeline: "6 months", status: "FOLLOWUP_D1" as const },
    { name: "Rahul Verma", phone: "+919876543216", source: "99acres", budget: "30L-50L", location: "Virar", timeline: "1 month", status: "VISITED" as const },
    { name: "Pooja Mehta", phone: "+919876543217", source: "Zapier", budget: "75L-1Cr", location: "Goregaon East", timeline: "2 months", status: "NO_ANSWER" as const },
    { name: "Deepak Kumar", phone: "+919876543218", source: "IndiaMart", budget: "50L-70L", location: "Borivali West", timeline: "1 month", status: "PENDING" as const },
    { name: "Kavita Desai", phone: "+919876543219", source: "Housing.com", budget: "1.2Cr-1.8Cr", location: "Worli", timeline: "3 months", status: "BOOKED" as const },
  ];

  let leadCount = 0;
  for (const l of sampleLeads) {
    const lead = await prisma.lead.upsert({
      where: { id: `seed-lead-${leadCount + 1}` },
      update: {},
      create: {
        id: `seed-lead-${leadCount + 1}`,
        clientId: client.id,
        name: l.name,
        phone: l.phone,
        source: l.source,
        rawPayload: {},
        budget: l.budget,
        location: l.location,
        timeline: l.timeline,
        status: l.status,
        callAttempts: l.status === "CALLING" || l.status === "FOLLOWUP_D1" ? 1 : 0,
        score: l.status === "CONVERTED" ? 95 : l.status === "COLD" ? 15 : 50,
      },
    });

    // Create booking for BOOKED leads
    if (l.status === "BOOKED" || l.status === "CONVERTED") {
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + Math.floor(Math.random() * 7) + 1);

      const booking = await prisma.booking.upsert({
        where: { id: `seed-booking-${leadCount + 1}` },
        update: {},
        create: {
          id: `seed-booking-${leadCount + 1}`,
          clientId: client.id,
          visitDate: bookingDate,
          visitTime: "11:00",
          propertyAddress: `${l.location}, Mumbai`,
          propertyName: "Sample Property",
          status: l.status === "CONVERTED" ? "VISITED" : "CONFIRMED",
          confirmedAt: new Date(),
          visitedAt: l.status === "CONVERTED" ? new Date() : null,
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { bookingId: booking.id },
      });
    }

    leadCount++;
  }
  console.log(`✅ ${leadCount} sample leads (with bookings) seeded`);

  // ─── 5. Sample Calls ────────────────────────────────────
  const sampleCalls = [
    { leadIndex: 0, status: "COMPLETED" as const, duration: 185, type: "QUALIFICATION" as const },
    { leadIndex: 4, status: "ANSWERED" as const, duration: 90, type: "QUALIFICATION" as const },
    { leadIndex: 5, status: "COMPLETED" as const, duration: 210, type: "QUALIFICATION" as const },
    { leadIndex: 7, status: "NO_ANSWER" as const, duration: 0, type: "QUALIFICATION" as const },
  ];

  for (let i = 0; i < sampleCalls.length; i++) {
    const c = sampleCalls[i];
    const leadId = `seed-lead-${c.leadIndex + 1}`;

    await prisma.call.upsert({
      where: { id: `seed-call-${i + 1}` },
      update: {},
      create: {
        id: `seed-call-${i + 1}`,
        clientId: client.id,
        leadId,
        type: c.type,
        direction: "outbound",
        duration: c.duration,
        status: c.status,
        transcript: c.duration > 0
          ? `AI: Namaste! Main LeadBridge ki taraf se baat kar raha hoon.\n${["Amit", "Vikram", "Ananya", "Deepak"][c.leadIndex]}: Haan ji, boliye.\nAI: Aapne property ke liye enquiry ki thi...`
          : null,
      },
    });
  }
  console.log(`✅ ${sampleCalls.length} sample calls seeded`);

  // ─── 6. Summary ─────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("🌱 SEEDING COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log("");
  console.log("📧 Admin:");
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: admin123!A`);
  console.log("");
  console.log("📧 Demo Broker:");
  console.log(`   Email:    ${clientEmail}`);
  console.log(`   Password: demo123!A`);
  console.log("");
  console.log("📊 Stats:");
  console.log(`   Territories: ${territoryCount}`);
  console.log(`   Leads:       ${leadCount}`);
  console.log(`   Calls:       ${sampleCalls.length}`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

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
    zone: string;
    tier: number;
  }

  const territories: TerritorySeed[] = [
    // Tier 1 — Metro cities (highest price)
    { city: "Mumbai", zone: "All", tier: 1 },
    { city: "Mumbai", zone: "South Mumbai", tier: 1 },
    { city: "Mumbai", zone: "Western Suburbs", tier: 1 },
    { city: "Mumbai", zone: "Navi Mumbai", tier: 1 },
    { city: "Mumbai", zone: "Thane", tier: 1 },
    { city: "Delhi", zone: "All", tier: 1 },
    { city: "Delhi", zone: "South Delhi", tier: 1 },
    { city: "Delhi", zone: "North Delhi", tier: 1 },
    { city: "Delhi", zone: "East Delhi", tier: 1 },
    { city: "Delhi", zone: "West Delhi", tier: 1 },
    { city: "Delhi", zone: "Central Delhi", tier: 1 },
    { city: "Bangalore", zone: "All", tier: 1 },
    { city: "Bangalore", zone: "Whitefield", tier: 1 },
    { city: "Bangalore", zone: "Electronic City", tier: 1 },
    { city: "Bangalore", zone: "Hebbal", tier: 1 },
    { city: "Hyderabad", zone: "All", tier: 1 },
    { city: "Hyderabad", zone: "HITEC City", tier: 1 },
    { city: "Hyderabad", zone: "Gachibowli", tier: 1 },
    { city: "Chennai", zone: "All", tier: 1 },
    { city: "Chennai", zone: "OMR", tier: 1 },
    { city: "Kolkata", zone: "All", tier: 1 },

    // Tier 2 — Major cities
    { city: "Ahmedabad", zone: "All", tier: 2 },
    { city: "Ahmedabad", zone: "SG Highway", tier: 2 },
    { city: "Pune", zone: "All", tier: 2 },
    { city: "Pune", zone: "Hinjewadi", tier: 2 },
    { city: "Pune", zone: "Koregaon Park", tier: 2 },
    { city: "Jaipur", zone: "All", tier: 2 },
    { city: "Lucknow", zone: "All", tier: 2 },
    { city: "Surat", zone: "All", tier: 2 },
    { city: "Chandigarh", zone: "All", tier: 2 },
    { city: "Bhopal", zone: "All", tier: 2 },
    { city: "Indore", zone: "All", tier: 2 },
    { city: "Nagpur", zone: "All", tier: 2 },
    { city: "Kochi", zone: "All", tier: 2 },
    { city: "Coimbatore", zone: "All", tier: 2 },
    { city: "Visakhapatnam", zone: "All", tier: 2 },
    { city: "Vadodara", zone: "All", tier: 2 },
    { city: "Thiruvananthapuram", zone: "All", tier: 2 },
    { city: "Guwahati", zone: "All", tier: 2 },

    // Tier 3 — Growing cities (budget-friendly)
    { city: "Agra", zone: "All", tier: 3 },
    { city: "Ajmer", zone: "All", tier: 3 },
    { city: "Allahabad", zone: "All", tier: 3 },
    { city: "Amritsar", zone: "All", tier: 3 },
    { city: "Aurangabad", zone: "All", tier: 3 },
    { city: "Bhubaneswar", zone: "All", tier: 3 },
    { city: "Dehradun", zone: "All", tier: 3 },
    { city: "Faridabad", zone: "All", tier: 3 },
    { city: "Ghaziabad", zone: "All", tier: 3 },
    { city: "Goa", zone: "All", tier: 3 },
    { city: "Gurgaon", zone: "All", tier: 3 },
    { city: "Gwalior", zone: "All", tier: 3 },
    { city: "Jabalpur", zone: "All", tier: 3 },
    { city: "Jalandhar", zone: "All", tier: 3 },
    { city: "Jammu", zone: "All", tier: 3 },
    { city: "Jodhpur", zone: "All", tier: 3 },
    { city: "Kanpur", zone: "All", tier: 3 },
    { city: "Kolhapur", zone: "All", tier: 3 },
    { city: "Kota", zone: "All", tier: 3 },
    { city: "Ludhiana", zone: "All", tier: 3 },
    { city: "Madurai", zone: "All", tier: 3 },
    { city: "Mangalore", zone: "All", tier: 3 },
    { city: "Meerut", zone: "All", tier: 3 },
    { city: "Mysore", zone: "All", tier: 3 },
    { city: "Nashik", zone: "All", tier: 3 },
    { city: "Noida", zone: "All", tier: 3 },
    { city: "Patna", zone: "All", tier: 3 },
    { city: "Rajkot", zone: "All", tier: 3 },
    { city: "Ranchi", zone: "All", tier: 3 },
    { city: "Salem", zone: "All", tier: 3 },
    { city: "Shimla", zone: "All", tier: 3 },
    { city: "Srinagar", zone: "All", tier: 3 },
    { city: "Tiruchirappalli", zone: "All", tier: 3 },
    { city: "Tirunelveli", zone: "All", tier: 3 },
    { city: "Udaipur", zone: "All", tier: 3 },
    { city: "Varanasi", zone: "All", tier: 3 },
    { city: "Vijayawada", zone: "All", tier: 3 },
    { city: "Warangal", zone: "All", tier: 3 },
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

  // ─── 4. Sample Leads (Rich Demo Data) ─────────────────────
  const STATUS_CONFIG: Array<{ status: string; weight: number; scoreRange: [number, number]; callAttempts: number; hasBooking: boolean; hasCall: boolean }> = [
    { status: "PENDING", weight: 4, scoreRange: [20, 45], callAttempts: 0, hasBooking: false, hasCall: false },
    { status: "CALLING", weight: 3, scoreRange: [30, 55], callAttempts: 1, hasBooking: false, hasCall: true },
    { status: "BOOKED", weight: 4, scoreRange: [55, 75], callAttempts: 1, hasBooking: true, hasCall: true },
    { status: "VISITED", weight: 2, scoreRange: [70, 85], callAttempts: 1, hasBooking: true, hasCall: true },
    { status: "CONVERTED", weight: 2, scoreRange: [90, 100], callAttempts: 1, hasBooking: true, hasCall: true },
    { status: "NO_ANSWER", weight: 3, scoreRange: [10, 30], callAttempts: 2, hasBooking: false, hasCall: true },
    { status: "NO_SHOW", weight: 2, scoreRange: [15, 35], callAttempts: 1, hasBooking: false, hasCall: true },
    { status: "FOLLOWUP_D1", weight: 2, scoreRange: [25, 45], callAttempts: 1, hasBooking: false, hasCall: true },
    { status: "FOLLOWUP_D2", weight: 2, scoreRange: [20, 40], callAttempts: 1, hasBooking: false, hasCall: false },
    { status: "FOLLOWUP_D3", weight: 2, scoreRange: [15, 35], callAttempts: 2, hasBooking: false, hasCall: true },
    { status: "COLD", weight: 2, scoreRange: [5, 20], callAttempts: 3, hasBooking: false, hasCall: true },
    { status: "CALL_FAILED", weight: 1, scoreRange: [5, 15], callAttempts: 1, hasBooking: false, hasCall: true },
  ];

  const FIRST_NAMES = [
    "Amit", "Priya", "Rahul", "Neha", "Vikram", "Ananya", "Suresh", "Pooja",
    "Deepak", "Kavita", "Rohit", "Shweta", "Manish", "Divya", "Alok",
    "Nandini", "Vivek", "Isha", "Gaurav", "Meera", "Tarun", "Ritu",
    "Harsh", "Bhavna", "Kunal", "Pallavi", "Siddharth", "Anjali", "Nitin", "Sonali",
  ];
  const LAST_NAMES = [
    "Sharma", "Patel", "Singh", "Verma", "Gupta", "Reddy", "Joshi", "Mehta",
    "Kumar", "Desai", "Nair", "Menon", "Chopra", "Agarwal", "Iyer",
  ];
  const SOURCES = ["99acres", "MagicBricks", "Housing.com", "JustDial", "Facebook", "Google Ads", "WhatsApp", "IndiaMart"];
  const LOCATIONS = [
    "Andheri West", "Andheri East", "Bandra West", "Malad West", "Goregaon East",
    "Powai", "Juhu", "Dadar", "Worli", "Lower Parel", "Chembur", "Thane", "Navi Mumbai",
  ];
  const BUDGETS = ["30L-50L", "50L-80L", "80L-1.2Cr", "1Cr-1.5Cr", "1.5Cr-2Cr", "2Cr-3Cr", "3Cr-5Cr"];
  const TIMELINES = ["Immediate", "1 month", "2-3 months", "3-4 months", "6 months"];

  function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
  function genPhone(): string {
    const prefix = pick(["98765", "99887", "91234", "97654", "88990", "87765", "96543", "90090"]);
    return `+91${prefix}${String(Math.floor(100000 + Math.random() * 899999))}`;
  }

  const totalLeadsWeight = STATUS_CONFIG.reduce((s, c) => s + c.weight, 0);
  const leadsToCreate = 35; // 35 new leads for richer demo
  let leadCount = 0;
  let bookingCount = 0;

  for (let i = 0; i < leadsToCreate; i++) {
    // Weighted random status selection
    let rand = Math.random() * totalLeadsWeight;
    let statusConfig = STATUS_CONFIG[0];
    for (const sc of STATUS_CONFIG) {
      rand -= sc.weight;
      if (rand <= 0) { statusConfig = sc; break; }
    }

    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const location = pick(LOCATIONS);
    const leadId = `seed-lead-${leadCount + 1}`;

    // Calculate realistic created date (spread across last 14 days)
    const daysAgo = Math.floor(Math.random() * 14);
    const hoursAgo = Math.floor(Math.random() * 24);
    const createdAt = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000);

    const score = Math.floor(Math.random() * (statusConfig.scoreRange[1] - statusConfig.scoreRange[0]) + statusConfig.scoreRange[0]);

    const lead = await prisma.lead.upsert({
      where: { id: leadId },
      update: {},
      create: {
        id: leadId,
        clientId: client.id,
        name: `${firstName} ${lastName}`,
        phone: genPhone(),
        source: pick(SOURCES),
        rawPayload: {},
        budget: pick(BUDGETS),
        location,
        timeline: pick(TIMELINES),
        status: statusConfig.status as any,
        callAttempts: statusConfig.callAttempts,
        score,
        createdAt,
        receivedAt: createdAt,
        ...(statusConfig.status === "CALLING" ? { firstCalledAt: new Date(createdAt.getTime() + 60000) } : {}),
        ...(statusConfig.status === "BOOKED" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), bookedAt: new Date(createdAt.getTime() + 3600000) } : {}),
        ...(statusConfig.status === "VISITED" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), bookedAt: new Date(createdAt.getTime() + 3600000) } : {}),
        ...(statusConfig.status === "CONVERTED" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), bookedAt: new Date(createdAt.getTime() + 3600000) } : {}),
        ...(statusConfig.status === "NO_SHOW" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), bookedAt: new Date(createdAt.getTime() + 3600000) } : {}),
        ...(statusConfig.status === "FOLLOWUP_D1" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), followupD1At: new Date(createdAt.getTime() + 86400000) } : {}),
        ...(statusConfig.status === "FOLLOWUP_D2" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), followupD1At: new Date(createdAt.getTime() + 86400000), followupD2At: new Date(createdAt.getTime() + 172800000) } : {}),
        ...(statusConfig.status === "FOLLOWUP_D3" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), followupD1At: new Date(createdAt.getTime() + 86400000), followupD2At: new Date(createdAt.getTime() + 172800000), followupD3At: new Date(createdAt.getTime() + 259200000) } : {}),
        ...(statusConfig.status === "COLD" ? { firstCalledAt: new Date(createdAt.getTime() + 60000), coldAt: new Date(createdAt.getTime() + 345600000) } : {}),
      },
    });

    // Create booking for leads that have one
    if (statusConfig.hasBooking) {
      bookingCount++;
      const visitDateOffset = statusConfig.status === "VISITED" || statusConfig.status === "CONVERTED" ? -3 : Math.floor(Math.random() * 5 + 2);
      const visitDate = new Date(Date.now() + visitDateOffset * 86400000);

      const booking = await prisma.booking.upsert({
        where: { id: `seed-booking-${leadCount + 1}` },
        update: {},
        create: {
          id: `seed-booking-${leadCount + 1}`,
          clientId: client.id,
          visitDate,
          visitTime: `${10 + Math.floor(Math.random() * 7)}:${Math.random() > 0.5 ? "00" : "30"} ${Math.random() > 0.5 ? "AM" : "PM"}`,
          propertyAddress: `${location}, Mumbai`,
          propertyName: `${Math.floor(Math.random() * 3) + 1}BHK Premium ${pick(["Apartment", "Flat", "Villa"])}`,
          status: statusConfig.status === "CONVERTED" || statusConfig.status === "VISITED" ? "VISITED" as any : statusConfig.status === "BOOKED" ? "CONFIRMED" as any : statusConfig.status as any,
          confirmedAt: new Date(createdAt.getTime() + 3600000),
          visitedAt: (statusConfig.status === "VISITED" || statusConfig.status === "CONVERTED") ? new Date(visitDate.getTime() + 3600000) : null,
          noShowAt: statusConfig.status === "NO_SHOW" ? visitDate : null,
        },
      });

      await prisma.lead.update({
        where: { id: lead.id },
        data: { bookingId: booking.id },
      });
    }

    // Create call records for leads that have calls
    if (statusConfig.hasCall) {
      const callDate = statusConfig.status === "CALLING" ? new Date() : createdAt;
      const duration = statusConfig.status === "FOLLOWUP_D2" ? null : Math.floor(Math.random() * 180) + 20;

      await prisma.call.upsert({
        where: { id: `seed-call-${leadCount + 1}` },
        update: {},
        create: {
          id: `seed-call-${leadCount + 1}`,
          clientId: client.id,
          leadId: lead.id,
          type: statusConfig.status === "FOLLOWUP_D1" ? "FOLLOWUP_D1" as any : statusConfig.status === "FOLLOWUP_D2" ? "FOLLOWUP_D2" as any : statusConfig.status === "FOLLOWUP_D3" ? "FOLLOWUP_D3" as any : "QUALIFICATION" as any,
          direction: "outbound",
          duration: duration || 0,
          status: statusConfig.status === "CALLING" ? "ANSWERED" as any : statusConfig.status === "FOLLOWUP_D2" ? "INITIATED" as any : (statusConfig.status === "CALL_FAILED" ? "FAILED" as any : "COMPLETED" as any),
          transcript: duration ? `[Simulated] Qualification call transcript for ${firstName} ${lastName}` : null,
          summary: statusConfig.status === "BOOKED" || statusConfig.status === "CONVERTED" || statusConfig.status === "VISITED"
            ? `Lead qualified — budget ${pick(BUDGETS)}, interested in ${location}`
            : statusConfig.status === "NO_ANSWER"
              ? "Lead did not answer the call"
              : statusConfig.status === "CALL_FAILED"
                ? "Call failed — number not reachable"
                : statusConfig.status === "NO_SHOW"
                  ? "Lead initially qualified but did not show for visit"
                  : `Follow-up D${statusConfig.status === "FOLLOWUP_D1" ? "1" : statusConfig.status === "FOLLOWUP_D3" ? "3" : "2"} call completed`,
          omnidimensionCallId: `sim-${lead.id}`,
          createdAt: callDate,
        },
      });
    }

    leadCount++;
  }
  console.log(`✅ ${leadCount} sample leads (${bookingCount} with bookings + calls) seeded`);

  // ─── 5. Summary ─────────────────────────────────────────
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
  console.log(`   Calls:       ${bookingCount + leadCount}`);
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

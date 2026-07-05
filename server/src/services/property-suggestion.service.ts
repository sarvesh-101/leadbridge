/**
 * Smart Property Suggestion Service.
 *
 * Matches leads to properties based on:
 * - Budget range (lead budget vs property price)
 * - Location/City match
 * - Bedrooms match
 * - Property type match
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MatchScore {
  propertyId: string;
  propertyName: string;
  propertyLocation: string | null;
  propertyPrice: number | null;
  propertyBedrooms: number | null;
  propertyType: string | null;
  score: number; // 0-100
  matchReasons: string[];
  image: string | null;
}

/**
 * Get property suggestions for a specific lead.
 */
export async function suggestPropertiesForLead(
  clientId: string,
  leadId: string
): Promise<MatchScore[]> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, clientId },
  });

  if (!lead) return [];

  const properties = await prisma.property.findMany({
    where: {
      clientId,
      status: { in: ["AVAILABLE"] },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  if (properties.length === 0) return [];

  const suggestions: MatchScore[] = properties.map((p) => {
    const reasons: string[] = [];
    let score = 0;

    // Budget match (lead budget vs property price)
    if (lead.budget && p.price) {
      const budgetNum = parseFloat(lead.budget.replace(/[^0-9]/g, ""));
      if (!isNaN(budgetNum) && budgetNum > 0) {
        const ratio = budgetNum / p.price;
        if (ratio >= 0.8 && ratio <= 1.5) {
          score += 30;
          reasons.push("💰 Within budget range");
        } else if (ratio > 1.5) {
          score += 15;
          reasons.push("💰 Under budget");
        } else if (ratio >= 0.5) {
          score += 10;
          reasons.push("💰 Slightly above budget");
        }
      }
    }

    // Location match
    if (lead.location) {
      const leadLoc = lead.location.toLowerCase();
      const propLoc = (p.location || "").toLowerCase();
      const propCity = (p.city || "").toLowerCase();
      if (propLoc.includes(leadLoc) || leadLoc.includes(propLoc) || propCity.includes(leadLoc)) {
        score += 25;
        reasons.push("📍 Matches preferred location");
      }
    }

    // Bedrooms match
    if (lead.bedrooms && p.bedrooms) {
      const leadBeds = parseInt(lead.bedrooms);
      if (!isNaN(leadBeds) && leadBeds === p.bedrooms) {
        score += 25;
        reasons.push(`🛏️ Exactly ${p.bedrooms} BHK`);
      } else if (!isNaN(leadBeds) && Math.abs(leadBeds - p.bedrooms) <= 1) {
        score += 15;
        reasons.push(`🛏️ Close to ${lead.bedrooms} BHK (${p.bedrooms} BHK available)`);
      }
    }

    // Featured boost
    if (p.featured) {
      score += 10;
      reasons.push("⭐ Featured property");
    }

    // Property type match
    if (lead.propertyType && p.name) {
      const type = lead.propertyType.toLowerCase();
      if (p.name.toLowerCase().includes(type) || (p.description || "").toLowerCase().includes(type)) {
        score += 10;
        reasons.push("🏠 Matches property type preference");
      }
    }

    return {
      propertyId: p.id,
      propertyName: p.name,
      propertyLocation: p.location || p.city || null,
      propertyPrice: p.price,
      propertyBedrooms: p.bedrooms,
      propertyType: lead.propertyType || null,
      score: Math.min(100, score),
      matchReasons: reasons,
      image: Array.isArray(p.images) && p.images.length > 0 ? String(p.images[0]) : null,
    };
  });

  return suggestions
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/**
 * Get top property matches across ALL leads (for automated matching).
 */
export async function matchAllLeadsToProperties(
  clientId: string
): Promise<Array<{ leadId: string; leadName: string; matches: MatchScore[] }>> {
  const leads = await prisma.lead.findMany({
    where: {
      clientId,
      status: { notIn: ["COLD", "CONVERTED"] },
    },
    orderBy: { score: "desc" },
    take: 50,
  });

  const results = await Promise.all(
    leads.map(async (lead) => {
      const matches = await suggestPropertiesForLead(clientId, lead.id);
      return { leadId: lead.id, leadName: lead.name, matches: matches.slice(0, 3) };
    })
  );

  return results.filter((r) => r.matches.length > 0);
}

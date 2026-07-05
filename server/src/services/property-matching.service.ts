/**
 * Automated Property Matching Engine.
 *
 * When a new lead arrives OR a new property is added, this service:
 * 1. Finds matching properties for the lead
 * 2. Creates an in-app notification for the broker
 * 3. Sends a WhatsApp notification if a strong match is found (score >= 70)
 */

import { PrismaClient } from "@prisma/client";
import { suggestPropertiesForLead } from "./property-suggestion.service";
import { enqueueNotification } from "../workers/queues";

const prisma = new PrismaClient();

/**
 * Trigger property matching for a newly created lead.
 * Called from the lead creation flow.
 */
export async function matchLeadToProperties(leadId: string, clientId: string): Promise<void> {
  try {
    const suggestions = await suggestPropertiesForLead(clientId, leadId);

    if (suggestions.length === 0) return;

    const topMatch = suggestions[0];

    // Get lead info
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { name: true, phone: true },
    });

    if (!lead) return;

    // Create in-app notification for broker
    const matchSummary = suggestions
      .slice(0, 3)
      .map((s) => `${s.propertyName} (${s.score}% match)`)
      .join(", ");

    await prisma.ownerNotification.create({
      data: {
        clientId,
        leadId,
        type: "PROPERTY_MATCH",
        message: `🏠 ${suggestions.length} properties match ${lead.name}: ${matchSummary}`,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // If strong match (score >= 70), send WhatsApp notification
    if (topMatch.score >= 70) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { ownerWhatsapp: true, businessName: true },
      });

      if (client?.ownerWhatsapp) {
        const matchLines = suggestions
          .slice(0, 3)
          .map(
            (s, i) =>
              `${i + 1}. ${s.propertyName}${s.propertyPrice ? ` — ₹${(s.propertyPrice / 100000).toFixed(1)}L` : ""}`
          )
          .join("\n");

        const text = [
          `🏠 Property Match Found`,
          ``,
          `Hi! We found ${suggestions.length} properties matching ${lead.name}'s requirements:`,
          ``,
          matchLines,
          ``,
          `View in dashboard to send these options.`,
          `— ${client.businessName}`,
        ].join("\n");

        await enqueueNotification({
          recipient: "owner",
          clientId,
          leadId,
          type: "property_match",
          data: { message: text, title: "Property Match Found", leadName: lead.name },
        });
      }
    }
  } catch (error) {
    console.error("Property matching error:", error);
  }
}

/**
 * Match a new property to all existing leads.
 * Called when a new property is added.
 */
export async function matchPropertyToLeads(propertyId: string, clientId: string): Promise<void> {
  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { name: true, price: true, location: true, bedrooms: true, city: true },
    });

    if (!property) return;

    // Find leads that might match this property
    const leads = await prisma.lead.findMany({
      where: {
        clientId,
        status: { notIn: ["COLD", "CONVERTED"] },
      },
      select: { id: true, name: true, budget: true, location: true, bedrooms: true },
      take: 100,
    });

    const matchedLeads: Array<{ name: string; id: string }> = [];

    for (const lead of leads) {
      let matchScore = 0;

      // Budget check
      if (lead.budget && property.price) {
        const budgetNum = parseFloat(lead.budget.replace(/[^0-9]/g, ""));
        if (!isNaN(budgetNum) && budgetNum > 0) {
          const ratio = budgetNum / property.price;
          if (ratio >= 0.8 && ratio <= 1.5) matchScore += 40;
        }
      }

      // Location check
      if (lead.location) {
        const propLoc = (property.location || property.city || "").toLowerCase();
        if (propLoc.includes(lead.location.toLowerCase())) matchScore += 30;
      }

      // Bedrooms check
      if (lead.bedrooms && property.bedrooms) {
        const leadBeds = parseInt(lead.bedrooms);
        if (!isNaN(leadBeds) && leadBeds === property.bedrooms) matchScore += 30;
      }

      if (matchScore >= 50) {
        matchedLeads.push({ name: lead.name, id: lead.id });
      }
    }

    if (matchedLeads.length === 0) return;

    // Create a single notification summarizing matches
    const summary = matchedLeads
      .slice(0, 5)
      .map((l) => l.name)
      .join(", ");

    const plural = matchedLeads.length > 5 ? ` +${matchedLeads.length - 5} more` : "";

    await prisma.ownerNotification.create({
      data: {
        clientId,
        type: "PROPERTY_MATCH",
        message: `🏠 New "${property.name}" matches ${matchedLeads.length} leads: ${summary}${plural}`,
        status: "sent",
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Property-to-lead matching error:", error);
  }
}

/**
 * SMS Lead Parser — extracts lead info from forwarded portal SMS messages.
 *
 * Handles formats from:
 *   - 99acres, MagicBricks, Housing.com, JustDial (auto-forwarded from broker's phone)
 *   - Manual entry by broker typing lead details
 *   - Generic unstructured text
 *
 * Returns normalized lead data or null if unparseable.
 */

import { logger } from "./logger";

export interface ParsedLead {
  name: string;
  phone: string;
  email?: string;
  source: string;
  budget?: string;
  location?: string;
  propertyType?: string;
  bedrooms?: string;
}

/**
 * Extract the last 10 digits from any phone string.
 */
function extractPhone(text: string): string | null {
  // Find all 10-digit sequences (optionally with +91, spaces, dashes)
  const phonePatterns = [
    /(\+91[\s-]?)?(\d{10})/g,
    /(\+91[\s-]?)?(\d{5}[\s-]\d{5})/g,
    /(\+91[\s-]?)?(\d{4}[\s-]\d{3}[\s-]\d{3})/g,
  ];

  for (const pattern of phonePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      // Prefer a number that appears near "phone", "mobile", "contact"
      for (const match of matches) {
        const before = text.substring(Math.max(0, match.index! - 30), match.index!);
        const phoneKeywords = /phone|mobile|contact|whatsapp|call|number|tel/i;
        if (phoneKeywords.test(before)) {
          // Found a phone near a keyword — most likely correct
          const digits = match[2] || match[0];
          return `+91${digits.replace(/\D/g, "").slice(-10)}`;
        }
      }
      // Fallback: use the first match
      const digits = matches[0][2] || matches[0][0];
      // If a phone number is near a budget keyword, it's more likely the lead's phone
      return `+91${digits.replace(/\D/g, "").slice(-10)}`;
    }
  }

  return null;
}

/**
 * Extract name from text.
 * Name is typically near "Name", "Contact", or is the first word before a phone number.
 */
function extractName(text: string): string | null {
  // 1. Explicit "Name:" or "Contact:" patterns
  const explicitPatterns = [
    /(?:Name|name|NAME)[:\s]*([A-Za-z\s.,]+?)(?:\s*(?:Phone|Mobile|Budget|Location|Contact|Email)|$)/,
    /(?:Contact|contact)[:\s]*([A-Za-z\s.,]+?)(?:\s*(?:Phone|Mobile|Budget|Location|Email)|$)/,
    /(?:Lead|lead)[:\s]*([A-Za-z\s.,]+?)(?:\s*(?:Phone|Mobile|Budget|Location|Email)|$)/,
  ];

  for (const pattern of explicitPatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length >= 3) {
      return match[1].trim().replace(/\s+/g, " ").replace(/,$/, "");
    }
  }

  // 2. After "Enquiry from" or "New lead from"
  const portalMatch = text.match(/(?:Enquiry|enquiry|Lead|lead|New)[^:]*?(?:from|:)?\s*([A-Za-z\s]{3,30}?)(?:\s*(?:Phone|Mobile|Budget|Contact)[:\s]|$)/);
  if (portalMatch && portalMatch[1].trim().length >= 3) {
    return portalMatch[1].trim();
  }

  // 3. First word before a phone number (common for manual entries)
  const phonePattern = /^(?:New\s+)?(?:Lead[:\s]*)?([A-Za-z][A-Za-z\s]{2,30}?)\s+(\+91|0|\d{10})/;
  const firstWordMatch = text.match(phonePattern);
  if (firstWordMatch && !firstWordMatch[1].toLowerCase().includes("budget") && !firstWordMatch[1].toLowerCase().includes("enquiry")) {
    return firstWordMatch[1].trim().replace(/\s+/g, " ").replace(/,$/, "");
  }

  return null;
}

/**
 * Extract budget from text.
 */
function extractBudget(text: string): string | null {
  const patterns = [
    /(?:Budget|budget)[:\s]*([\d,.]+)\s*(?:Lakh|lakh|L|Cr|cr|K|k|Thousands?|thousands?)?/,
    /(?:Budget|budget)[:\s]*([\d,.]+)\s*(?:-|to)\s*[\d,.]+\s*(?:Lakh|lakh|L|Cr|cr|K|k)?/,
    /₹?\s*([\d,.]+)\s*(?:Lakh|lakh|L|Cr|cr|K|k)(?:s?\.?)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = match[1].replace(/,/g, "");
      const suffix = match[0].match(/(?:Cr|cr|Crore|crore)/) ? "Cr" : 
                     match[0].match(/(?:Lakh|lakh|L)/) ? "L" : "";
      return suffix ? `${value} ${suffix}` : value;
    }
  }

  return null;
}

/**
 * Extract location from text.
 */
function extractLocation(text: string): string | null {
  const patterns = [
    /(?:Location|location)[:\s]*([A-Za-z\s,.-]+?)(?:\s*(?:Budget|Phone|Mobile|Email|Property|Contact|$))/,
    /(?:Area|area)[:\s]*([A-Za-z\s,.-]+?)(?:\s*(?:Budget|Phone|Mobile|Email|Property|Contact|$))/,
    /in\s+([A-Za-z][A-Za-z\s,.-]{5,40}?)(?:\s*(?:Budget|Phone|Mobile|Email|\.|$|,?\s*(?:for|near|at)))/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const loc = match[1].trim().replace(/\s+/g, " ");
      if (loc.length >= 3 && loc.length <= 50) {
        return loc;
      }
    }
  }

  return null;
}

/**
 * Extract property type or bedrooms from text.
 */
function extractPropertyInfo(text: string): { propertyType?: string; bedrooms?: string } {
  const result: { propertyType?: string; bedrooms?: string } = {};

  // Bedroom patterns: "2 BHK", "3BHK", "1 RK", "2 Bedroom"
  const bedroomMatch = text.match(/(\d)\s*(?:BHK|RK|Bedroom|bedroom|bhk|rk|Bed|bed)/);
  if (bedroomMatch) {
    result.bedrooms = bedroomMatch[1];
    if (bedroomMatch[0].toLowerCase().includes("rk")) {
      result.propertyType = "RK";
    } else {
      result.propertyType = "Apartment";
    }
  }

  // Property type patterns
  const typePatterns = [
    /(?:Property Type|property type|Property)[:\s]*([A-Za-z\s]+?)(?:\s*(?:Budget|Location|Phone|Mobile|Email|Contact|$))/,
    /(?:Type|type)[:\s]*([A-Za-z\s]+?)(?:\s*(?:Budget|Location|Phone|Mobile|Email|Contact|$))/,
  ];

  for (const pattern of typePatterns) {
    const match = text.match(pattern);
    if (match && !result.propertyType) {
      result.propertyType = match[1].trim();
    }
  }

  // Also detect common property type mentions
  if (!result.propertyType) {
    if (/\b(?:Villa|villa|House|house|Bungalow|bungalow|Plot|plot|Land|land)\b/.test(text)) {
      result.propertyType = "House";
    } else if (/\b(?:Flat|flat|Apartment|apartment)\b/.test(text)) {
      result.propertyType = "Apartment";
    } else if (/\b(?:Commercial|commercial|Shop|shop|Office|office)\b/.test(text)) {
      result.propertyType = "Commercial";
    }
  }

  return result;
}

/**
 * Extract email from text.
 */
function extractEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

/**
 * Identify the portal/source from SMS text.
 */
function identifySource(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("99acres")) return "99acres";
  if (lower.includes("magicbricks") || lower.includes("magic bricks") || lower.includes("mb:")) return "magicbricks";
  if (lower.includes("housing.com") || lower.includes("housing ")) return "housing";
  if (lower.includes("justdial") || lower.includes("just dial")) return "justdial";
  if (lower.includes("facebook") || lower.includes("fb ")) return "facebook";
  if (lower.includes("google")) return "google";
  if (lower.includes("commonfloor")) return "commonfloor";
  if (lower.includes("sulekha")) return "sulekha";
  return "sms_forward";
}

/**
 * Main parsing function — takes raw SMS body and returns structured lead info.
 * Returns null if essential fields (phone) could not be extracted.
 */
export function parseSmsLead(body: string): ParsedLead | null {
  if (!body || body.trim().length < 5) return null;

  const source = identifySource(body);
  const phone = extractPhone(body);
  const name = extractName(body);
  const email = extractEmail(body);
  const budget = extractBudget(body);
  const location = extractLocation(body);
  const propertyInfo = extractPropertyInfo(body);

  if (!phone) {
    logger.warn({ body: body.substring(0, 100) }, "SMS lead parser: Could not extract phone number");
    return null;
  }

  if (!name && !phone) {
    logger.warn({ body: body.substring(0, 100) }, "SMS lead parser: Could not extract name or phone");
    return null;
  }

  return {
    name: name || (phone ? `Lead from ${source}` : "Unknown Lead"),
    phone,
    email: email || undefined,
    source,
    budget: budget || undefined,
    location: location || undefined,
    propertyType: propertyInfo.propertyType,
    bedrooms: propertyInfo.bedrooms,
  };
}

/**
 * Enhanced parsing that also returns the raw "confidence score" (0-1) of
 * how likely the parsing is correct. Higher = more reliable extraction.
 */
export function parseSmsLeadWithConfidence(body: string): { lead: ParsedLead | null; confidence: number } {
  if (!body || body.trim().length < 5) {
    return { lead: null, confidence: 0 };
  }

  const lead = parseSmsLead(body);
  if (!lead) return { lead: null, confidence: 0 };

  // Calculate confidence based on how many fields were extracted
  let foundFields = 0;
  const totalFields = 6; // name, phone, email, budget, location, property info

  if (lead.name && lead.name !== "Unknown Lead" && lead.name !== `Lead from ${lead.source}`) foundFields++;
  if (lead.phone) foundFields++;
  if (lead.email) foundFields++;
  if (lead.budget) foundFields++;
  if (lead.location) foundFields++;
  if (lead.propertyType || lead.bedrooms) foundFields++;

  // Phone is mandatory, so min confidence is ~0.3
  const confidence = Math.min(1, foundFields / totalFields) + 0.3;
  return { lead, confidence: Math.min(1, confidence) };
}

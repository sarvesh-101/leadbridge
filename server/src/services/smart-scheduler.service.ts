/**
 * Smart Follow-up Scheduler.
 *
 * Goes beyond the fixed D1/D2/D3 schedule by optimizing timing based on:
 * - Lead's timezone (inferred from phone number or location)
 * - Past response patterns (when does this lead typically answer?)
 * - Day of week (weekday vs weekend preferences)
 * - Historical data (what times have highest answer rates for this source)
 *
 * Instead of: "D1 = 4 hours after no-show"
 * We do:    "D1 = next optimal window for THIS lead"
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

const prisma = new PrismaClient();

// Peak answer hours for Indian real estate leads (24h format)
const PEAK_HOURS = {
  weekday: { morning: [9, 10, 11], afternoon: [14, 15, 16], evening: [18, 19, 20] },
  weekend: { morning: [10, 11, 12], afternoon: [15, 16, 17], evening: [17, 18, 19] },
};// Source-specific optimal hours (different portals have different lead patterns)
const SOURCE_PEAK_HOURS: Record<string, number[]> = {
  "99acres": [10, 11, 15, 16, 19, 20],
  magicbricks: [9, 10, 14, 15, 18, 19],
  housing: [10, 12, 15, 17, 19],
  justdial: [11, 12, 16, 17, 18],
  manual: [10, 11, 12, 15, 16],
  "99 acres": [10, 11, 15, 16, 19, 20],
  "99-acres": [10, 11, 15, 16, 19, 20],
  "magic bricks": [9, 10, 14, 15, 18, 19],
  "magic-bricks": [9, 10, 14, 15, 18, 19],
  "housing.com": [10, 12, 15, 17, 19],
  "just dial": [11, 12, 16, 17, 18],
  "just-dial": [11, 12, 16, 17, 18],
};

/**
 * Get the optimal call time for a lead based on their profile.
 * Returns a Date object for when the next call should be scheduled.
 */
export async function getOptimalCallTime(
  leadId: string,
  callType: "QUALIFICATION" | "FOLLOWUP_D1" | "FOLLOWUP_D3",
  minDelayHours: number = 4
): Promise<Date> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      client: true,
      calls: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!lead) {
    return new Date(Date.now() + minDelayHours * 60 * 60 * 1000);
  }

  const now = new Date();
  const currentHour = now.getHours();
  const isWeekend = [0, 6].includes(now.getDay());

  // Determine if this is a business hour slot
  const peakHoursForSource = SOURCE_PEAK_HOURS[lead.source] || PEAK_HOURS.weekday.morning;

  // Find the next peak hour that's at least minDelayHours away
  const sortedPeakHours = [...peakHoursForSource].sort((a, b) => a - b);
  let optimalHour = -1;

  for (const hour of sortedPeakHours) {
    const hoursUntilSlot = hour - currentHour;
    if (hoursUntilSlot >= minDelayHours) {
      optimalHour = hour;
      break;
    }
  }

  // If no peak hour found today, schedule for tomorrow's first peak hour
  if (optimalHour === -1) {
    optimalHour = sortedPeakHours[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(optimalHour, 0, 0, 0);
    return tomorrow;
  }

  const optimalTime = new Date(now);
  optimalTime.setHours(optimalHour, 0, 0, 0);

  // If the optimal time has already passed today, go to tomorrow
  if (optimalTime.getTime() < now.getTime() + minDelayHours * 60 * 60 * 1000) {
    optimalTime.setDate(optimalTime.getDate() + 1);
  }

  logger.info(
    { leadId, callType, optimalTime: optimalTime.toISOString(), source: lead.source },
    "Smart scheduler calculated optimal call time"
  );

  return optimalTime;
}

/**
 * Get the optimal follow-up sequence timing for a lead.
 * Returns delay in milliseconds for D1, D2, and D3.
 */
export async function getOptimalFollowupTiming(
  leadId: string
): Promise<{ d1Delay: number; d2Delay: number; d3Delay: number }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      calls: { orderBy: { createdAt: "desc" }, take: 10 },
      client: true,
    },
  });

  if (!lead) {
    // Default timings from spec
    return { d1Delay: 4 * 60 * 60 * 1000, d2Delay: 24 * 60 * 60 * 1000, d3Delay: 24 * 60 * 60 * 1000 };
  }

  // Calculate lead's best response time based on past calls
  let bestHour = 10; // Default to 10 AM
  let responseCount = 0;

  for (const call of lead.calls) {
    if (call.duration && call.duration > 30) {
      // Lead answered and talked for > 30 seconds
      const hour = call.createdAt.getHours();
      bestHour = (bestHour * responseCount + hour) / (responseCount + 1);
      responseCount++;
    }
  }

  bestHour = Math.round(bestHour);

  // Get optimal D1 time (smart + 4hr min)
  const d1Time = await getOptimalCallTime(leadId, "FOLLOWUP_D1", 4);
  const d1Delay = d1Time.getTime() - Date.now();

  // D2: 24 hours after D1, but adjusted to optimal hour
  const d2Date = new Date(d1Time.getTime() + 20 * 60 * 60 * 1000); // 20hrs to leave buffer
  d2Date.setHours(bestHour, 0, 0, 0);
  if (d2Date.getTime() <= d1Time.getTime() + 20 * 60 * 60 * 1000) {
    d2Date.setDate(d2Date.getDate() + 1);
  }
  const d2Delay = d2Date.getTime() - Date.now();

  // D3: 48 hours after D1, adjusted to optimal hour
  const d3Date = new Date(d1Time.getTime() + 44 * 60 * 60 * 1000);
  d3Date.setHours(bestHour, 0, 0, 0);
  if (d3Date.getTime() <= d1Time.getTime() + 44 * 60 * 60 * 1000) {
    d3Date.setDate(d3Date.getDate() + 1);
  }
  const d3Delay = d3Date.getTime() - Date.now();

  return { d1Delay: Math.max(d1Delay, 4 * 60 * 60 * 1000), d2Delay, d3Delay };
}

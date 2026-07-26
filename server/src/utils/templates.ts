/**
 * WhatsApp message template builders.
 * All messages are plain text under 1024 chars (no template approval needed).
 */

import { config } from "../config";

const PORTAL_URL = `${config.FRONTEND_URL || "https://leadbridge.com"}/customer/login`;

interface CustomerBookingConfirmationData {
  customerName: string;
  propertyName: string;
  propertyAddress: string;
  visitDate: string;
  visitTime: string;
  brokerName: string;
  brokerPhone: string;
  mapsLink: string;
  businessName: string;
}

export function bookingConfirmationCustomer(data: CustomerBookingConfirmationData): string {
  return [
    `Namaste ${data.customerName}!`,
    ``,
    `Aapki property visit confirm ho gayi hai.`,
    ``,
    `Property: ${data.propertyName}`,
    `Address: ${data.propertyAddress}`,
    `Date: ${data.visitDate}`,
    `Time: ${data.visitTime}`,
    ``,
    `${data.brokerName} aapse milenge. Unka number: ${data.brokerPhone}`,
    ``,
    `Directions: ${data.mapsLink}`,
    ``,
    `Manage your booking: ${PORTAL_URL}`,
    ``,
    `Koi sawaal ho toh is number pe WhatsApp karein.`,
    ``,
    `— ${data.businessName}`,
  ].join("\n");
}

interface OwnerBookingConfirmedData {
  leadName: string;
  leadPhone: string;
  source: string;
  budget: string;
  bedrooms: string;
  propertyType: string;
  location: string;
  timeline: string;
  visitDate: string;
  visitTime: string;
  sentiment: string;
  aiSummary: string;
  dashboardLink: string;
}

export function bookingConfirmedOwner(data: OwnerBookingConfirmedData): string {
  return [
    `🔔 New Booking Alert`,
    ``,
    `Lead: ${data.leadName} (${data.leadPhone})`,
    `Source: ${data.source}`,
    `Budget: ${data.budget}`,
    `Looking for: ${data.bedrooms} ${data.propertyType} in ${data.location}`,
    `Timeline: ${data.timeline}`,
    ``,
    `Visit booked:`,
    `Date: ${data.visitDate} at ${data.visitTime}`,
    ``,
    `Sentiment: ${data.sentiment}`,
    ``,
    `Summary: ${data.aiSummary}`,
    ``,
    `View full details: ${data.dashboardLink}`,
  ].join("\n");
}

interface BookingReminderCustomerData {
  customerName: string;
  visitTime: string;
  propertyAddress: string;
  mapsLink: string;
  brokerName: string;
  businessName: string;
}

export function bookingReminderCustomer(data: BookingReminderCustomerData): string {
  return [
    `Namaste ${data.customerName}!`,
    ``,
    `Aaj aapki property visit hai.`,
    ``,
    `Time: ${data.visitTime}`,
    `Address: ${data.propertyAddress}`,
    data.mapsLink,
    ``,
    `${data.brokerName} aapka intezaar kar rahe hain. Aane ki confirmation ke liye reply karein.`,
    ``,
    `Manage your booking: ${PORTAL_URL}`,
    ``,
    `— ${data.businessName}`,
  ].join("\n");
}

interface BookingDayOwnerData {
  leadName: string;
  visitTime: string;
  reminderSentAt: string;
}

export function bookingDayStatusOwner(data: BookingDayOwnerData): string {
  return [
    `Today's Visit Reminder Sent`,
    ``,
    `Lead: ${data.leadName}`,
    `Time: ${data.visitTime}`,
    `Reminder: Sent at ${data.reminderSentAt}`,
    ``,
    `Keep your phone available.`,
    `— LeadBridge`,
  ].join("\n");
}

interface NoShowAlertData {
  leadName: string;
  visitTime: string;
  dashboardLink: string;
}

export function noShowAlertOwner(data: NoShowAlertData): string {
  return [
    `⚠️ No-Show Alert`,
    ``,
    `${data.leadName} did not show up for their ${data.visitTime} visit.`,
    ``,
    `We are starting a 3-day follow-up sequence automatically:`,
    `• Day 1: AI call this afternoon`,
    `• Day 2: WhatsApp tomorrow`,
    `• Day 3: Final AI call`,
    ``,
    `You will receive updates after each attempt.`,
    ``,
    `View lead: ${data.dashboardLink}`,
  ].join("\n");
}

export function followupD2WhatsAppCustomer(data: { location: string; businessName: string; propertyName?: string }): string {
  return [
    `Namaste,`,
    ``,
    `Hum samajhte hain aap kal nahi aa paaye.`,
    ``,
    `Kya aap abhi bhi ${data.location} mein property dekhne mein interested hain?`,
    ``,
    `Iss weekend ke liye aapke liye special slots available hain.`,
    ``,
    `Interested hain? Bas reply karein aur hum arrange kar dete hain.`,
    ``,
    `— ${data.businessName}`,
  ].join("\n");
}

interface ColdLeadOwnerData {
  leadName: string;
  leadPhone: string;
  source: string;
  budget: string;
  lastContactAt: string;
  dashboardLink: string;
}

export function coldLeadOwner(data: ColdLeadOwnerData): string {
  return [
    `❄️ Lead Marked Cold`,
    ``,
    `${data.leadName} (${data.leadPhone}) did not respond after 3 follow-up attempts over 3 days.`,
    ``,
    `Source: ${data.source}`,
    `Budget: ${data.budget}`,
    `Last contact: ${data.lastContactAt}`,
    ``,
    `No further follow-ups will be sent.`,
    ``,
    `View history: ${data.dashboardLink}`,
  ].join("\n");
}

export function followupResultOwner(data: { leadName: string; day: number; result: string; dashboardLink: string }): string {
  const dayLabel = data.day === 1 ? "Day 1" : data.day === 2 ? "Day 2" : "Day 3";
  return [
    `🔁 Follow-up ${dayLabel} Result`,
    ``,
    `${data.leadName}: ${data.result}`,
    ``,
    `View lead: ${data.dashboardLink}`,
  ].join("\n");
}

export function conversionOwner(data: { leadName: string; dealAmount?: string; dashboardLink: string }): string {
  return [
    `🎉 Deal Won!`,
    ``,
    `Congratulations! ${data.leadName} has been marked as converted.`,
    ...(data.dealAmount ? [`Deal amount: ${data.dealAmount}`] : []),
    ``,
    `View details: ${data.dashboardLink}`,
  ].join("\n");
}

/**
 * Get the language-appropriate instruction for the chatbot system prompt.
 */
export function getChatbotLanguageInstruction(language: string): string {
  switch (language) {
    case "hindi":
      return "Respond in Hindi (formal Hindi, not Hinglish)";
    case "english":
      return "Respond in English";
    case "hinglish":
    default:
      return "Respond in Hinglish (mix Hindi + English naturally)";
  }
}

/**
 * Get a language-appropriate fallback message for the chatbot when AI processing fails.
 */
export function getChatbotFallbackMessage(
  leadName: string,
  language: string,
  ownerWhatsapp: string
): string {
  switch (language) {
    case "hindi":
      return `नमस्ते ${leadName} जी! आपका संदेश प्राप्त हो गया है। मैं जल्द ही आपको उत्तर दूंगा। किसी भी तत्काल समस्या के लिए कृपया ${ownerWhatsapp} पर संपर्क करें। 🙏`;
    case "english":
      return `Hello ${leadName}! Your message has been received. I will get back to you shortly. For any urgent matters, please contact ${ownerWhatsapp}. 🙏`;
    case "hinglish":
    default:
      return `Namaste ${leadName} ji! Aapka message mil gaya. Is waqt main aapko jald hi reply karunga. Koi urgent ho toh ${ownerWhatsapp} pe contact karein. 🙏`;
  }
}

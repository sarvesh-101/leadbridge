/**
 * WhatsApp AI Chatbot — handles incoming WhatsApp messages from leads.
 *
 * When a customer replies to a LeadBridge message (e.g., "Yes I'm coming" or "Reschedule"),
 * this service uses DeepSeek to understand the intent and take appropriate action.
 *
 * Supported intents:
 * - CONFIRM_APPOINTMENT: "Yes, I'll be there" → marks as confirmed
 * - RESCHEDULE: "Can we change the time?" → offers available slots
 * - CANCEL: "Not interested anymore" → marks as cold
 * - INTERESTED: "Tell me more about the property" → sends property details
 * - GENERAL: Any other query → natural response
 */

import { prisma } from "../utils/prisma-shared";
import { config } from "../config";
import { logger } from "../utils/logger";
import { chatCompletion } from "./openrouter.service";
import { sendTextMessage } from "./whatsapp.service";
import { enqueueCall, enqueueNotification } from "../workers/queues";
import { emitStatusChange } from "./websocket.service";
import { getChatbotLanguageInstruction, getChatbotFallbackMessage } from "../utils/templates";

interface ChatbotResponse {
  intent: "CONFIRM_APPOINTMENT" | "RESCHEDULE" | "CANCEL" | "INTERESTED" | "GENERAL";
  reply: string;
  action?: Record<string, unknown>;
}

/**
 * Handle an incoming WhatsApp message from a lead.
 * Uses DeepSeek to understand intent and generate a natural reply.
 */
export async function handleIncomingMessage(
  fromNumber: string,
  messageBody: string,
  waMessageId: string
): Promise<void> {
  // Find the lead by phone number
  const lead = await prisma.lead.findFirst({
    where: { phone: { contains: fromNumber.slice(-10) } },
    include: {
      client: true,
      booking: true,
    },
  });

  if (!lead || !lead.client) {
    logger.warn({ fromNumber }, "Unknown sender — no matching lead found");
    return;
  }

  const client = lead.client;
  const booking = lead.booking;

  // ─── Fetch matching properties for the lead ─────────────────────
  // This gives the chatbot real inventory to answer questions like
  // "What 2BHK flats under 1Cr do you have?" instead of making up generic replies.
  let propertyContext = "";
  try {
    const { suggestPropertiesForLead } = await import("./property-suggestion.service");
    const matches = await suggestPropertiesForLead(client.id, lead.id);
    if (matches.length > 0) {
      propertyContext = "\nAvailable properties matching this lead:\n" + matches
        .slice(0, 5)
        .map((p, i) =>
          `${i + 1}. ${p.propertyName}${p.propertyPrice ? ` — ₹${(p.propertyPrice / 100000).toFixed(1)}L` : ""}` +
          `${p.propertyBedrooms ? `, ${p.propertyBedrooms} BHK` : ""}` +
          `${p.propertyLocation ? `, ${p.propertyLocation}` : ""}` +
          ` (${p.score}% match)`
        )
        .join("\n");
    }
  } catch {
    // Non-critical — chatbot works without property data
  }

  // Use the broker's configured language preference for chatbot responses
  const languageInstruction = getChatbotLanguageInstruction(client.language || "hinglish");

  // Build context for the AI model
  const contextMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    {
      role: "system",
      content: `You are a helpful real estate assistant for ${client.businessName}. 
You handle WhatsApp messages from property leads. 

Context:
- Lead: ${lead.name}
- Status: ${lead.status}
- Budget: ${lead.budget || "Not specified"}
- Looking for: ${lead.propertyType || "property"} in ${lead.location || "their area"}
${booking ? `- Visit booked: ${booking.visitDate.toISOString().split("T")[0]} at ${booking.visitTime}` : "- No visit booked yet"}
- Timeline: ${lead.timeline || "Not specified"}
${propertyContext}

Rules:
1. ${languageInstruction}
2. Be warm, helpful, and concise
3. If they confirm a visit → say thank you and confirm
4. If they want to reschedule → ask for preferred date/time
5. If they cancel → acknowledge politely
6. If interested → share enthusiasm and offer to book
7. NEVER make up property details — use the available properties listed above to answer inventory questions
8. If the lead asks about a specific property type/location/budget, recommend from the available properties list

Respond with JSON:
{
  "intent": "CONFIRM_APPOINTMENT|RESCHEDULE|CANCEL|INTERESTED|GENERAL",
  "reply": "your natural response following the language instruction",
  "action": {} // optional action data
}`,
    },
    {
      role: "user",
      content: messageBody,
    },
  ];

  try {
    const result = await chatCompletion(
      contextMessages,
      { temperature: 0.7, max_tokens: 512, timeout: 15000 }
    );

    const parsed: ChatbotResponse = JSON.parse(result.content.replace(/```json/g, "").replace(/```/g, "").trim());

    // Send reply via WhatsApp
    await sendTextMessage({
      to: lead.phone,
      text: parsed.reply,
      recipientType: "customer",
    });

    // Log incoming message
    await prisma.customerNotification.create({
      data: {
        leadId: lead.id,
        type: "INCOMING_WHATSAPP",
        channel: "whatsapp",
        message: messageBody,
        status: "received",
        waMessageId,
        sentAt: new Date(),
      },
    });

    // Log bot reply
    await prisma.customerNotification.create({
      data: {
        leadId: lead.id,
        type: "CHATBOT_REPLY",
        channel: "whatsapp",
        message: parsed.reply,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Execute action based on intent
    await handleIntent(lead, client, booking, parsed);

  } catch (error: any) {
    logger.error({ err: error.message, fromNumber }, "Chatbot processing failed");
    // Fallback reply in the client's configured language
    const fallbackText = getChatbotFallbackMessage(lead.name, client.language || "hinglish", client.ownerWhatsapp);
    await sendTextMessage({
      to: lead.phone,
      text: fallbackText,
      recipientType: "customer",
    });
  }
}

async function handleIntent(
  lead: any,
  client: any,
  booking: any,
  parsed: ChatbotResponse
): Promise<void> {
  switch (parsed.intent) {
    case "CONFIRM_APPOINTMENT":
      if (booking && booking.status === "REMINDED") {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CONFIRMED" },
        });
        await emitStatusChange(lead.id, "BOOKED", client.id, {
          customerConfirmed: true,
        });
        // Notify owner
        await enqueueNotification({
          recipient: "owner",
          leadId: lead.id,
          clientId: client.id,
          type: "BOOKING_DAY_STATUS",
          bookingId: booking.id,
          data: {
            leadName: lead.name,
            result: "Customer confirmed attendance via WhatsApp",
            dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${lead.id}`,
          },
        });
      }
      break;

    case "RESCHEDULE":
      // Notify owner to handle rescheduling
      await enqueueNotification({
        recipient: "owner",
        leadId: lead.id,
        clientId: client.id,
        type: "NO_SHOW_ALERT",
        bookingId: booking?.id,
        data: {
          leadName: lead.name,
          message: `${lead.name} wants to reschedule their visit. Please contact them to arrange a new date.`,
          dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${lead.id}`,
        },
      });
      break;

    case "CANCEL":
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "COLD", coldAt: new Date() },
      });
      await emitStatusChange(lead.id, "COLD", client.id, { source: "whatsapp" });
      await enqueueNotification({
        recipient: "owner",
        leadId: lead.id,
        clientId: client.id,
        type: "COLD_LEAD",
        data: {
          leadName: lead.name,
          leadPhone: lead.phone,
          source: lead.source,
          budget: lead.budget || "Not specified",
          lastContactAt: new Date().toISOString(),
          dashboardLink: `${config.FRONTEND_URL}/dashboard/leads/${lead.id}`,
        },
      });
      break;

    case "INTERESTED":
      if (!booking) {
        // Offer to book — trigger a call
        await enqueueCall({
          leadId: lead.id,
          clientId: client.id,
          callType: "QUALIFICATION",
          attempt: 1,
        }, 60 * 1000); // 1 minute delay to let the WhatsApp message sink in
      }
      break;

    case "GENERAL":
      // Already replied naturally — no action needed
      break;
  }
}

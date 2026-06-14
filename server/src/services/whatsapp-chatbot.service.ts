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

import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";
import { sendTextMessage } from "./whatsapp.service";
import { enqueueCall, enqueueNotification } from "../workers/queues";
import { emitStatusChange } from "./websocket.service";

const prisma = new PrismaClient();
const deepseekApi = axios.create({
  baseURL: config.DEEPSEEK_BASE_URL,
  headers: {
    Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

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

  // Build context for DeepSeek
  const contextMessages = [
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

Rules:
1. Respond in Hinglish (mix Hindi + English naturally)
2. Be warm, helpful, and concise
3. If they confirm a visit → say thank you and confirm
4. If they want to reschedule → ask for preferred date/time
5. If they cancel → acknowledge politely
6. If interested → share enthusiasm and offer to book
7. NEVER make up property details

Respond with JSON:
{
  "intent": "CONFIRM_APPOINTMENT|RESCHEDULE|CANCEL|INTERESTED|GENERAL",
  "reply": "your natural response in Hinglish",
  "action": {} // optional action data
}`,
    },
    {
      role: "user",
      content: messageBody,
    },
  ];

  try {
    const response = await deepseekApi.post("/chat/completions", {
      model: config.DEEPSEEK_MODEL,
      messages: contextMessages,
      temperature: 0.7,
      max_tokens: 512,
    });

    const content = response.data.choices[0]?.message?.content || "";
    const parsed: ChatbotResponse = JSON.parse(content.replace(/```json/g, "").replace(/```/g, "").trim());

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
    // Fallback reply
    await sendTextMessage({
      to: lead.phone,
      text: `Namaste ${lead.name} ji! Aapka message mil gaya. Is waqt main aapko jald hi reply karunga. Koi urgent ho toh ${client.ownerWhatsapp} pe contact karein. 🙏`,
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

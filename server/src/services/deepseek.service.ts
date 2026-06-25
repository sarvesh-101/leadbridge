import { config } from "../config";
import { logger } from "../utils/logger";
import { chatCompletion } from "./openrouter.service";

/**
 * AI-powered post-call analysis service.
 * Uses OpenRouter (Qwen3 / Llama 3.3 / Llama 3.2) with automatic model fallback.
 */

export interface ExtractedData {
  qualified: boolean;
  budget: string;
  location: string | null;
  timeline: string;
  propertyType: string;
  bedrooms: string;
  bookingRequested: boolean;
  bookingDate: string | null;
  bookingTime: string | null;
  faqsAsked: string[];
  sentiment: string;
  language: string;
  summary: string;
}

/**
 * Analyze call transcript and extract structured qualification data.
 */
export async function extractFromTranscript(transcript: string): Promise<ExtractedData> {
  const systemPrompt = `You are a real estate lead qualifier. Extract structured data from this call transcript. Return ONLY valid JSON, no markdown. The JSON must match this schema exactly:
{
  "qualified": boolean,
  "budget": "under-50L|50L-1Cr|1Cr-2Cr|above-2Cr|not-specified",
  "location": "area they mentioned or null",
  "timeline": "immediate|1-3months|3-6months|browsing|not-specified",
  "propertyType": "flat|villa|plot|commercial|rental|not-specified",
  "bedrooms": "1BHK|2BHK|3BHK|4BHK+|any|not-specified",
  "bookingRequested": boolean,
  "bookingDate": "YYYY-MM-DD or null",
  "bookingTime": "HH:MM AM/PM or null",
  "faqsAsked": ["list of questions they asked"],
  "sentiment": "positive|neutral|negative",
  "language": "hindi|english|hinglish",
  "summary": "2-3 sentence summary in English"
}`;

  try {
    const result = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      { temperature: 0.1, max_tokens: 1024 }
    );

    const parsed = JSON.parse(result.content.replace(/```json/g, "").replace(/```/g, "").trim()) as ExtractedData;

    logger.info(
      { qualified: parsed.qualified, bookingRequested: parsed.bookingRequested, sentiment: parsed.sentiment, model: result.model },
      "AI extraction completed"
    );

    return parsed;
  } catch (error: any) {
    logger.error({ err: error.message }, "DeepSeek extraction failed");
    // Return default values on failure
    return {
      qualified: false,
      budget: "not-specified",
      location: null,
      timeline: "not-specified",
      propertyType: "not-specified",
      bedrooms: "not-specified",
      bookingRequested: false,
      bookingDate: null,
      bookingTime: null,
      faqsAsked: [],
      sentiment: "neutral",
      language: "hinglish",
      summary: "Extraction failed due to an error.",
    };
  }
}

/**
 * Generate an AI call script for a client based on their business info.
 */
export async function generateCallScript(businessInfo: {
  businessName: string;
  ownerName: string;
  propertyTypes: string[];
  locations: string[];
  language: string;
}): Promise<string> {
  const prompt = `Create a real estate outbound call script for ${businessInfo.businessName}.
Owner: ${businessInfo.ownerName}
Property types: ${businessInfo.propertyTypes.join(", ")}
Locations: ${businessInfo.locations.join(", ")}
Language: ${businessInfo.language}

Write a natural Hinglish script that:
1. Opens with name confirmation
2. Introduces as AI assistant
3. Qualifies the lead (budget, location, timeline, bedrooms)
4. Answers FAQs naturally
5. Books a site visit
6. Confirms details
7. Closes politely

Return ONLY the script text, no explanation.`;

  try {
    const result = await chatCompletion(
      [
        { role: "system", content: "You are a professional real estate call script writer." },
        { role: "user", content: prompt },
      ],
      { temperature: 0.7, max_tokens: 2048 }
    );

    return result.content;
  } catch (error: any) {
    logger.error({ err: error.message }, "Script generation failed");
    throw new Error("Failed to generate call script");
  }
}

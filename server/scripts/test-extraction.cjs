/**
 * Live test of AI transcript extraction (deepseek.service.ts extractFromTranscript).
 *
 * Reads credentials from server/.env (via dotenv), sends a realistic sample
 * call transcript through the extraction pipeline, and prints the structured result.
 *
 * Usage:
 *   cd server && node scripts/test-extraction.cjs
 *   or: npm run test:extraction
 *
 * Exits 0 on success, 1 on failure.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const key = process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY;
if (!key) {
  console.error("❌ No LLM key set in server/.env (OPENROUTER_API_KEY or DEEPSEEK_API_KEY)");
  process.exit(1);
}

const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
const baseUrl = useOpenRouter
  ? "https://openrouter.ai/api/v1"
  : process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const model = useOpenRouter
  ? "deepseek/deepseek-chat"
  : process.env.DEEPSEEK_MODEL || "deepseek-chat";

console.log(`ℹ️  Provider: ${useOpenRouter ? "OpenRouter" : "DeepSeek"} | Model: ${model}`);

// ─── Realistic sample transcript ─────────────────────────────────
// This mimics a typical Hinglish lead qualification call.
const SAMPLE_TRANSCRIPT = `
AI Agent: Hello, this is Priya from LeadBridge. Am I speaking with Mr. Sharma?
Customer: Haan ji, main Rajesh Sharma bol raha hoon.
AI Agent: Hi Mr. Sharma! I'm calling about your interest in property in Mumbai. Can you tell me what kind of property you're looking for?
Customer: Haan, main ek 2BHK flat dhundh raha hoon in Andheri West area.
AI Agent: Andheri West is a great location! What is your budget range for the property?
Customer: Mera budget around 1.5 crore tak hai. Max 2 crore.
AI Agent: That's a good budget for Andheri. When are you planning to buy the property?
Customer: Jitna jaldi ho sake, preferably within 2-3 months.
AI Agent: Great, I can help you with that! Have you already booked a site visit?
Customer: Nahi, I haven't booked anything yet. Can you arrange a visit?
AI Agent: Absolutely! I can schedule a visit for you. When would be convenient?
Customer: This Saturday, around 11 AM, would be perfect.
AI Agent: Saturday at 11 AM — let me check availability. Yes, I can book that for you. I'll confirm the appointment via SMS. Before I do, do you have any questions about the property or the area?
Customer: Haan, batao kidhar hai exactly? And what about the parking situation? And schools nearby?
AI Agent: The property is located near DN Nagar metro station, Andheri West. It has dedicated parking, and there are several good schools within 2 km like Jamnabai Narsee School and Podar International. Any other questions?
Customer: Nahi, that's all. Thank you!
AI Agent: Thank you Mr. Sharma! I'll confirm your booking for Saturday 11 AM at the Andheri West property. Have a great day!
`;

const axios = require("axios");

(async () => {
  console.log("─── Sending transcript for AI extraction ───");
  console.log("Transcript length:", SAMPLE_TRANSCRIPT.length, "chars");
  console.log("");

  const systemPrompt = `You are a real estate lead qualifier. Extract structured data from this call transcript. Return ONLY valid JSON, no markdown. The JSON must match this schema exactly:
{
  "qualified": boolean,
  "budget": "under-50L|50L-1Cr|1Cr-2Cr|above-2Cr|not-specified",
  "location": "area they mentioned or null",
  "timeline": "immediate|1-3months|3-6months|browsing|not-specified",
  "propertyType": "flat|villa|plot|commercial|rental|not-specified",
  "bedrooms": "1BHK|2BHK|3BHK|4BHK+|any|not-specified",
  "bookingRequested": boolean,
  "bookingDate": "YYYY-MM-DD (today is 2026-08-03 — interpret relative day/week words like 'this Saturday', 'next week', 'tomorrow' as the actual upcoming date, e.g. 'this Saturday' → 2026-08-08) or null",
  "bookingTime": "HH:MM AM/PM or null",
  "faqsAsked": ["list of questions they asked"],
  "sentiment": "positive|neutral|negative",
  "language": "hindi|english|hinglish",
  "summary": "2-3 sentence summary in English"
}`;

  try {
    const start = Date.now();

    const res = await axios.post(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: SAMPLE_TRANSCRIPT },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          // OpenRouter expects these; harmless for DeepSeek
          "HTTP-Referer": "https://leadbridge.com",
          "X-Title": "LeadBridge",
        },
        timeout: 60000,
      }
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const content = res.data?.choices?.[0]?.message?.content || "";
    const usage = res.data?.usage;
    const responseModel = res.data?.model || model;

    console.log(`✅ Extraction complete (${elapsed}s)`);
    console.log(`   Model: ${responseModel}`);
    if (usage) {
      console.log(`   Tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total`);
      // Estimate cost: OpenRouter deepseek-chat ~$0.14/M input, $0.28/M output tokens
      const cost = ((usage.prompt_tokens || 0) * 0.14 + (usage.completion_tokens || 0) * 0.28) / 1_000_000;
      console.log(`   Est. cost: $${cost.toFixed(6)}`);
    }
    console.log("");

    // Try to parse the JSON response
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      console.log("📋 EXTRACTED DATA:");
      console.log(JSON.stringify(parsed, null, 2));
      console.log("");

      // Validate key fields
      const checks = [
        parsed.qualified === true ? "✅ qualified: true" : "❌ qualified: " + parsed.qualified,
        parsed.budget === "1Cr-2Cr" ? "✅ budget: 1Cr-2Cr" : "⚠️ budget: " + parsed.budget,
        parsed.location?.toLowerCase().includes("andheri") ? "✅ location: includes Andheri" : "⚠️ location: " + parsed.location,
        parsed.timeline === "1-3months" ? "✅ timeline: 1-3months" : "⚠️ timeline: " + parsed.timeline,
        parsed.propertyType === "flat" ? "✅ propertyType: flat" : "⚠️ propertyType: " + parsed.propertyType,
        parsed.bedrooms === "2BHK" ? "✅ bedrooms: 2BHK" : "⚠️ bedrooms: " + parsed.bedrooms,
        parsed.bookingRequested === true ? "✅ bookingRequested: true" : "❌ bookingRequested: " + parsed.bookingRequested,
        parsed.bookingDate ? "✅ bookingDate: " + parsed.bookingDate : "⚠️ bookingDate: null",
        parsed.bookingTime ? "✅ bookingTime: " + parsed.bookingTime : "⚠️ bookingTime: null",
        Array.isArray(parsed.faqsAsked) && parsed.faqsAsked.length > 0 ? `✅ faqsAsked: ${parsed.faqsAsked.length} question(s)` : "⚠️ faqsAsked: empty",
        ["positive", "neutral", "negative"].includes(parsed.sentiment) ? "✅ sentiment: " + parsed.sentiment : "⚠️ sentiment: " + parsed.sentiment,
        parsed.language === "hinglish" ? "✅ language: hinglish" : "⚠️ language: " + parsed.language,
        parsed.summary && parsed.summary.length > 20 ? "✅ summary: " + parsed.summary.slice(0, 80) + "..." : "⚠️ summary: " + (parsed.summary || "missing"),
      ];
      checks.forEach(c => console.log("   " + c));

      const passCount = checks.filter(c => c.startsWith("✅")).length;
      const total = checks.length;
      console.log(`\n📊 ${passCount}/${total} fields correct`);
      process.exit(passCount >= 10 ? 0 : 1);
    } catch (parseError) {
      console.error("❌ Failed to parse AI response as JSON");
      console.error("   Raw response:", content.slice(0, 500));
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ LLM request failed:");
    if (e.response) {
      console.error(`   status: ${e.response.status}`);
      console.error(`   body: ${JSON.stringify(e.response.data)}`);
    } else {
      console.error(`   ${e.message}`);
    }
    process.exit(1);
  }
})();
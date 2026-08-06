/**
 * LLM connectivity test — reads credentials from server/.env, NEVER contains secrets.
 *
 * Usage:
 *   cd server && node scripts/test-llm.cjs
 *   or: npm run test:llm
 *
 * Verifies the DeepSeek (or any OpenAI-compatible) API key configured in .env
 * by sending a tiny chat completion. Exits 0 on success, 1 on failure.
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const axios = require("axios");

// OpenRouter takes precedence when its key is present (same rule as the server code)
const useOpenRouter = !!process.env.OPENROUTER_API_KEY;
const key = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.DEEPSEEK_API_KEY;
const baseUrl = useOpenRouter
  ? "https://openrouter.ai/api/v1"
  : process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const model = useOpenRouter
  ? "deepseek/deepseek-chat"
  : process.env.DEEPSEEK_MODEL || "deepseek-chat";

if (!key) {
  console.error("❌ No LLM key set in server/.env (OPENROUTER_API_KEY or DEEPSEEK_API_KEY)");
  process.exit(1);
}
console.log(`ℹ️  Using provider: ${useOpenRouter ? "OpenRouter" : "DeepSeek"}`);

(async () => {
  try {
    const res = await axios.post(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        model,
        messages: [
          {
            role: "user",
            content:
              'Reply with exactly the word: DEEPSEEK_OK (nothing else, no quotes)',
          },
        ],
        max_tokens: 10,
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const reply = res.data?.choices?.[0]?.message?.content || "";
    console.log(`✅ LLM OK — endpoint: ${baseUrl} | model: ${res.data?.model || model}`);
    console.log(`   reply: ${JSON.stringify(reply)}`);
    console.log(`   usage: ${JSON.stringify(res.data?.usage || "n/a")}`);
    process.exit(0);
  } catch (e) {
    console.error(`❌ LLM request failed (${baseUrl} / ${model}):`);
    if (e.response) {
      console.error(`   status: ${e.response.status}`);
      console.error(`   body: ${JSON.stringify(e.response.data)}`);
    } else {
      console.error(`   ${e.message}`);
    }
    process.exit(1);
  }
})();

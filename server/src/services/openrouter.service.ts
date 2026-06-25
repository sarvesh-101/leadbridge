/**
 * OpenRouter AI Service — shared LLM client with model fallback chain.
 *
 * Provides a single `chatCompletion()` function used by:
 *   - deepseek.service.ts  → post-call transcript extraction + script generation
 *   - whatsapp-chatbot.service.ts → incoming message intent classification + reply
 *
 * Fallback chain (tried in order):
 *   1. Primary: Qwen3 Next 80B A3B Instruct (or whatever DEEPSEEK_MODEL is set to)
 *   2. Fallback 1: Llama 3.3 70B Instruct (best Hindi support, strong reasoning)
 *   3. Fallback 2: Llama 3.2 3B Instruct (lightweight, fast, always available)
 *
 * On 429 (rate limited), connection timeout, or network error → skip to next model.
 * On 400/401/500 → throw immediately (not a rate-limit issue).
 */

import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

// ─── Fallback model chain ───────────────────────────────────────
// The primary model is configurable via DEEPSEEK_MODEL env var.
// Hardcoded fallbacks match the user's OpenRouter API keys.
const PRIMARY_MODEL = config.DEEPSEEK_MODEL;
const FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",   // Best Hindi, strong reasoning
  "meta-llama/llama-3.2-3b-instruct:free",     // Lightweight, fast, always up
];

/** Full list of models to try, deduplicated */
const MODEL_CHAIN = [
  PRIMARY_MODEL,
  ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_MODEL),
];

// ─── Shared Axios client ────────────────────────────────────────
// Uses OpenRouter-specific headers for analytics + rate-limit tracking.
const openrouterClient = axios.create({
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://leadbridge.com",
    "X-Title": "LeadBridge",
  },
  timeout: 30000, // 30s default — overridden per-call in consumers
});

/** Role message for chat completions */
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options passed through to the API call (temperature, max_tokens, etc.) */
type CompletionOptions = Partial<{
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  stop: string | string[];
  timeout: number;
}>;

/** Successful API response shape */
interface CompletionResult {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Send a chat completion request with automatic model fallback.
 *
 * Tries each model in the chain until one succeeds.
 *
 * @param messages - Array of chat messages (system, user, assistant)
 * @param options - Optional overrides for temperature, max_tokens, timeout, etc.
 * @returns The completion result with content and metadata
 * @throws Error if ALL models in the chain fail
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  const { timeout, ...apiOptions } = options;

  let lastError: Error | null = null;

  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];

    try {
      const response = await openrouterClient.post(
        "/chat/completions",
        {
          model,
          messages,
          ...apiOptions,
        },
        {
          // Per-call timeout override if provided
          ...(timeout ? { timeout } : {}),
        } as AxiosRequestConfig
      );

      const choice = response.data.choices?.[0];
      const content: string = choice?.message?.content || "";
      const usage = response.data.usage;

      logger.debug(
        { model, tokens: usage?.total_tokens || "?" },
        `OpenRouter: ${model} succeeded`
      );

      return { content, model, usage };
    } catch (error: any) {
      lastError = error;

      const isAxiosError = axios.isAxiosError(error);
      const status = isAxiosError ? error.response?.status : null;
      const errorCode = isAxiosError ? error.code : null;
      const errorMessage = isAxiosError
        ? error.response?.data?.error?.message || error.message
        : error.message;

      // Determine if this error is retryable (rate limit or network issue)
      const isRetryable =
        status === 429 ||                         // Rate limited
        status === 503 ||                         // Service unavailable
        errorCode === "ECONNABORTED" ||            // Timeout
        errorCode === "ECONNRESET" ||              // Connection reset
        errorCode === "ERR_NETWORK" ||             // Network error
        !status;                                   // No response at all

      if (isRetryable && i < MODEL_CHAIN.length - 1) {
        logger.warn(
          { model, status, err: errorMessage },
          `OpenRouter: ${model} failed (retryable) — trying fallback ${MODEL_CHAIN[i + 1]}`
        );
        continue; // Try next model
      }

      // Non-retryable error or last model — log and bubble up
      logger.error(
        { model, status, err: errorMessage },
        `OpenRouter: ${model} failed (non-retryable)`
      );
    }
  }

  // All models exhausted
  const finalMessage = lastError
    ? `All AI models exhausted. Last error: ${lastError.message}`
    : "All AI models exhausted with no specific error";

  logger.error({ models: MODEL_CHAIN }, finalMessage);
  throw new Error(finalMessage);
}

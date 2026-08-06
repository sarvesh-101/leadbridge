/**
 * Shared LLM client (OpenAI-compatible) with model fallback chain.
 *
 * Provides a single `chatCompletion()` function used by:
 *   - deepseek.service.ts  → post-call transcript extraction + script generation
 *   - whatsapp-chatbot.service.ts → incoming message intent classification + reply
 *
 * Provider selection:
 *   - If OPENROUTER_API_KEY is set → OpenRouter (hosts DeepSeek/Qwen/Llama models).
 *   - Otherwise → DEEPSEEK_BASE_URL / DEEPSEEK_MODEL (DeepSeek or any OpenAI-compatible API).
 *
 * Fallback chain (tried in order):
 *   1. Primary: deepseek/deepseek-chat (OpenRouter) or config.DEEPSEEK_MODEL (DeepSeek)
 *   2. Fallbacks: deepseek-v4-flash + qwen3.7-flash (OpenRouter, all verified live)
 *
 * On 429 (rate limited), connection timeout, or network error → skip to next model.
 * On 400/401/500 → throw immediately (not a rate-limit issue).
 */

import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { config } from "../config";
import { logger } from "../utils/logger";

// ─── Provider selection ─────────────────────────────────────────
// OpenRouter takes precedence when its key is present.
const USE_OPENROUTER = !!config.OPENROUTER_API_KEY;

// ─── Fallback model chain ───────────────────────────────────────
// All models below verified working with this key (2026-08-03).
const PRIMARY_MODEL = USE_OPENROUTER
  ? "deepseek/deepseek-chat"      // Fast, general purpose (DeepSeek-V3 on OpenRouter)
  : config.DEEPSEEK_MODEL;
const FALLBACK_MODELS = USE_OPENROUTER
  ? [
      "deepseek/deepseek-v4-flash",  // Fast fallback — verified
      "qwen/qwen3.7-flash",          // Lightweight fallback — verified
    ]
  : [
      "deepseek-chat",      // Fast, general purpose (DeepSeek-V3)
      "deepseek-reasoner",  // Stronger reasoning (R1) — fallback only
    ];

/** Full list of models to try, deduplicated */
const MODEL_CHAIN = [
  PRIMARY_MODEL,
  ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_MODEL),
];

// ─── Shared Axios client ────────────────────────────────────────
// Base URL + key depend on which provider is active.
// Extra headers are harmless for providers that ignore them.
const openrouterClient = axios.create({
  baseURL: USE_OPENROUTER
    ? "https://openrouter.ai/api/v1"
    : config.DEEPSEEK_BASE_URL,
  headers: {
    Authorization: `Bearer ${USE_OPENROUTER ? config.OPENROUTER_API_KEY : config.DEEPSEEK_API_KEY}`,
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
        `LLM: ${model} succeeded`
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
          `LLM: ${model} failed (retryable) — trying fallback ${MODEL_CHAIN[i + 1]}`
        );
        continue; // Try next model
      }

      // Non-retryable error or last model — log and bubble up
      logger.error(
        { model, status, err: errorMessage },
        `LLM: ${model} failed (non-retryable)`
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

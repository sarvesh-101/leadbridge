/**
 * Voice AI Provider Factory
 * 
 * Automatically selects the voice AI provider based on VOICE_AI_PROVIDER env var.
 * 
 *   DEMO_MODE=true                 → DemoVoiceAIProvider (simulated, no API keys needed)
 *   VOICE_AI_PROVIDER=omnidimension → OmnidimensionVoiceProvider (default)
 *   (unset)                         → OmnidimensionVoiceProvider
 */

import { config } from "../../config";
import { logger } from "../../utils/logger";
import { VoiceAIProvider } from "./voice-ai-provider.interface";

let cachedProvider: VoiceAIProvider | null = null;

/**
 * Get the configured voice AI provider instance.
 */
export function getVoiceAIProvider(): VoiceAIProvider {
  if (cachedProvider) return cachedProvider;

  // ─── DEMO MODE: Use simulated provider ─────────────────────
  if (config.DEMO_MODE) {
    const { DemoVoiceAIProvider } = require("./demo-voice-provider");
    cachedProvider = new DemoVoiceAIProvider();
    logger.info("🎯 Voice AI provider: DEMO MODE (all operations simulated)");
    return cachedProvider!;
  }

  const providerName = (config.VOICE_AI_PROVIDER || "omnidimension").toLowerCase();

  switch (providerName) {
    case "omnidimension":
    default: {
      const { OmnidimensionVoiceProvider } = require("./omnidimension-voice-provider");
      cachedProvider = new OmnidimensionVoiceProvider();
      logger.info("Voice AI provider: Omnidimension");
      break;
    }
  }

  return cachedProvider!;
}

/**
 * Reset the cached provider (useful for testing)
 */
export function resetVoiceAIProvider(): void {
  cachedProvider = null;
}

export type { VoiceAIProvider } from "./voice-ai-provider.interface";
export type * from "./types";

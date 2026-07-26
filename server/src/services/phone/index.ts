/**
 * Phone Provider Factory
 * 
 * Automatically selects the phone provider based on PHONE_PROVIDER env var.
 * 
 *   DEMO_MODE=true               → DemoPhoneProvider (simulated, no API keys needed)
 *   PHONE_PROVIDER=twilio        → TwilioPhoneProvider
 *   PHONE_PROVIDER=omnidimension → OmnidimensionPhoneProvider (default)
 *   (unset)                     → OmnidimensionPhoneProvider
 */

import { config } from "../../config";
import { logger } from "../../utils/logger";
import { PhoneProvider } from "./phone-provider.interface";

let cachedProvider: PhoneProvider | null = null;

/**
 * Get the configured phone provider instance.
 * Cache the instance so we don't create a new one on every request.
 */
export function getPhoneProvider(): PhoneProvider {
  if (cachedProvider) return cachedProvider;

  // ─── DEMO MODE: Use simulated provider ─────────────────────
  if (config.DEMO_MODE) {
    const { DemoPhoneProvider } = require("./demo-phone-provider");
    cachedProvider = new DemoPhoneProvider();
    logger.info("📞 Phone provider: DEMO MODE (all operations simulated)");
    return cachedProvider!;
  }

  const providerName = (config.PHONE_PROVIDER || "omnidimension").toLowerCase();

  switch (providerName) {
    case "twilio": {
      const { TwilioPhoneProvider } = require("./twilio-provider");
      cachedProvider = new TwilioPhoneProvider();
      logger.info("Phone provider: Twilio (direct number purchasing)");
      break;
    }
    case "omnidimension":
    default: {
      const { OmnidimensionPhoneProvider } = require("./omnidimension-provider");
      cachedProvider = new OmnidimensionPhoneProvider();
      logger.info(`Phone provider: Omnidimension${providerName !== "omnidimension" ? ` (fallback from "${providerName}")` : ""}`);
      break;
    }
  }

  return cachedProvider!;
}

/**
 * Reset the cached provider (useful for testing or config changes)
 */
export function resetPhoneProvider(): void {
  cachedProvider = null;
}

export type { PhoneProvider } from "./phone-provider.interface";
export type * from "./types";

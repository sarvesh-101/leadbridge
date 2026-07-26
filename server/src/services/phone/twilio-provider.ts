/**
 * Twilio Phone Provider
 * 
 * Purchases and manages phone numbers directly via Twilio API.
 * No middleman — you own the numbers in your Twilio account.
 * 
 * Setup:
 *   PHONE_PROVIDER=twilio
 *   TWILIO_ACCOUNT_SID=your_account_sid
 *   TWILIO_AUTH_TOKEN=your_auth_token
 *   TWILIO_PHONE_NUMBER_SID=your_twilio_number_sid (optional, for outbound calls)
 */

import { config } from "../../config";
import { logger } from "../../utils/logger";
import { PhoneProvider } from "./phone-provider.interface";
import type {
  PhoneNumberInfo,
  PurchasePhoneOptions,
  PurchasePhoneResult,
  ListPhoneNumbersOptions,
  ListPhoneNumbersResult,
  PhoneProviderConfig,
} from "./types";

export class TwilioPhoneProvider implements PhoneProvider {
  readonly name = "twilio";

  private client: import("twilio").Twilio | null = null;

  private getClient(): import("twilio").Twilio {
    if (!this.client) {
      const twilio = require("twilio") as typeof import("twilio");
      this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
    }
    return this.client;
  }

  isConfigured(): boolean {
    return !!(config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN);
  }

  getConfig(): PhoneProviderConfig {
    return {
      name: "twilio",
      configured: this.isConfigured(),
    };
  }

  async listNumbers(options?: ListPhoneNumbersOptions): Promise<ListPhoneNumbersResult> {
    if (!this.isConfigured()) {
      return { numbers: [], total: 0 };
    }

    try {
      const client = this.getClient();
      const incomingNumbers = await client.incomingPhoneNumbers.list({
        pageSize: options?.pageSize || 50,
        ...(options?.region ? { phoneNumber: `+1${options.region}` } : {}),
      });

      const numbers: PhoneNumberInfo[] = incomingNumbers.map((n: any) => ({
        id: n.sid,
        phoneNumber: n.phoneNumber,
        provider: "twilio",
        capabilities: [
          n.capabilities?.voice ? "voice" : null,
          n.capabilities?.sms ? "sms" : null,
          n.capabilities?.mms ? "mms" : null,
        ].filter(Boolean) as string[],
        region: n.phoneNumber?.substring(0, 3) || "",
        price: n.price ? `$${n.price}/month` : undefined,
      }));

      return { numbers, total: incomingNumbers.length };
    } catch (error: any) {
      logger.error({ err: error.message }, "Failed to list Twilio phone numbers");
      return { numbers: [], total: 0 };
    }
  }

  async purchaseNumber(options?: PurchasePhoneOptions): Promise<PurchasePhoneResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: "Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env",
      };
    }

    try {
      const client = this.getClient();

      // If a specific phone number is provided, search for it
      const searchParams: Record<string, any> = {
        voiceEnabled: true,
        smsEnabled: true,
        ...(options?.region ? { inRegion: options.region } : {}),
        ...(options?.areaCode ? { areaCode: options.areaCode } : {}),
      };

      // Check if we already have this number or need to buy one
      if (options?.phoneNumber) {
        // Import existing number — just return it
        logger.info({ phoneNumber: options.phoneNumber }, "Using existing Twilio number");
        return {
          success: true,
          phoneNumber: {
            id: options.phoneNumber,
            phoneNumber: options.phoneNumber,
            provider: "twilio",
          },
          message: "Number already in your Twilio account",
        };
      }

      // Search for available numbers
      const areaCodeNum = options?.areaCode ? parseInt(options.areaCode) : undefined;
      const availableNumbers = await client.availablePhoneNumbers("IN")
        .local.list({ 
          voiceEnabled: true,
          smsEnabled: true,
          ...(areaCodeNum ? { areaCode: areaCodeNum } : {}),
          limit: 5,
        } as any);

      if (availableNumbers.length === 0) {
        return {
          success: false,
          message: "No available phone numbers found in the selected region. Try a different area code.",
        };
      }

      // Purchase the first available number
      const selectedNumber = availableNumbers[0];
      const purchasedNumber = await client.incomingPhoneNumbers.create({
        phoneNumber: selectedNumber.phoneNumber,
        voiceUrl: config.TWILIO_VOICE_URL || undefined,
        smsUrl: config.TWILIO_SMS_URL || undefined,
        voiceMethod: "POST",
        smsMethod: "POST",
      });

      logger.info(
        { phoneNumber: purchasedNumber.phoneNumber, sid: purchasedNumber.sid },
        "Twilio phone number purchased successfully"
      );

      return {
        success: true,
        phoneNumber: {
          id: purchasedNumber.sid,
          phoneNumber: purchasedNumber.phoneNumber,
          provider: "twilio",
          capabilities: ["voice", "sms"],
          region: "IN",
        },
        message: `Number purchased: ${purchasedNumber.phoneNumber}`,
      };
    } catch (error: any) {
      logger.error({ err: error.message }, "Failed to purchase Twilio phone number");
      return {
        success: false,
        message: `Failed to purchase Twilio number: ${error.message}. Check your Twilio account balance and permissions.`,
      };
    }
  }

  async releaseNumber(phoneNumberId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const client = this.getClient();
      await client.incomingPhoneNumbers(phoneNumberId).remove();
      logger.info({ sid: phoneNumberId }, "Twilio phone number released");
      return true;
    } catch (error: any) {
      logger.error({ err: error.message, sid: phoneNumberId }, "Failed to release Twilio number");
      return false;
    }
  }

  async getNumber(phoneNumberId: string): Promise<PhoneNumberInfo | null> {
    if (!this.isConfigured()) return null;

    try {
      const client = this.getClient();
      const n = await client.incomingPhoneNumbers(phoneNumberId).fetch() as any;
      return {
        id: n.sid,
        phoneNumber: n.phoneNumber,
        provider: "twilio",
        capabilities: [
          n.capabilities?.voice ? "voice" : null,
          n.capabilities?.sms ? "sms" : null,
        ].filter(Boolean) as string[],
        region: n.region || n.isoCountry || "",
      };
    } catch {
      return null;
    }
  }
}

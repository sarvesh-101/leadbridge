/**
 * Omnidimension Phone Provider
 * 
 * Wraps the existing Omnidimension phone number API service
 * to implement the PhoneProvider interface.
 * 
 * Use this when PHONE_PROVIDER=omnidimension (default)
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

// Import the existing omnidimension phone service
import {
  listPhoneNumbers as omniListNumbers,
  purchasePhoneNumber as omniPurchaseNumber,
  attachPhoneNumber as omniAttachNumber,
  detachPhoneNumber as omniDetachNumber,
} from "../omnidimension-phone.service";

export class OmnidimensionPhoneProvider implements PhoneProvider {
  readonly name = "omnidimension";

  isConfigured(): boolean {
    return !!(config.OMNIDIM_API_KEY);
  }

  getConfig(): PhoneProviderConfig {
    return {
      name: "omnidimension",
      configured: this.isConfigured(),
    };
  }

  async listNumbers(options?: ListPhoneNumbersOptions): Promise<ListPhoneNumbersResult> {
    try {
      const omniNumbers = await omniListNumbers({
        pageNo: options?.page,
        pageSize: options?.pageSize,
      });

      const numbers: PhoneNumberInfo[] = omniNumbers.map((n) => ({
        id: String(n.id),
        phoneNumber: n.phone_number,
        provider: n.number_provider || "omnidim",
        capabilities: ["voice"],
        region: "",
        price: undefined,
      }));

      return { numbers, total: numbers.length };
    } catch (error: any) {
      logger.error({ err: error.message }, "Failed to list Omnidimension phone numbers");
      return { numbers: [], total: 0 };
    }
  }

  async purchaseNumber(options?: PurchasePhoneOptions): Promise<PurchasePhoneResult> {
    try {
      const result = await omniPurchaseNumber({
        region: options?.region,
        areaCode: options?.areaCode,
        provider: "omnidim",
      });

      if (!result.success || !result.phoneNumber) {
        return {
          success: false,
          message: result.message || "Failed to purchase number via Omnidimension",
        };
      }

      return {
        success: true,
        phoneNumber: {
          id: String(result.phoneNumber.id),
          phoneNumber: result.phoneNumber.phone_number,
          provider: "omnidimension",
          capabilities: ["voice"],
        },
        message: result.message,
      };
    } catch (error: any) {
      logger.error({ err: error.message }, "Failed to purchase Omnidimension phone number");
      return {
        success: false,
        message: `Omnidimension purchase failed: ${error.message}`,
      };
    }
  }

  async releaseNumber(phoneNumberId: string): Promise<boolean> {
    try {
      await omniDetachNumber(parseInt(phoneNumberId));
      return true;
    } catch (error: any) {
      logger.error({ err: error.message, id: phoneNumberId }, "Failed to release number");
      return false;
    }
  }

  async getNumber(phoneNumberId: string): Promise<PhoneNumberInfo | null> {
    try {
      const numbers = await this.listNumbers();
      return numbers.numbers.find((n) => n.id === phoneNumberId) || null;
    } catch {
      return null;
    }
  }
}

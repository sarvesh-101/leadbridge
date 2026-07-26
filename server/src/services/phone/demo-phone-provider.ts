/**
 * DemoPhoneProvider — Simulates phone number management for investor demos.
 *
 * No external API calls. Every operation returns realistic fake data.
 * Numbers are in the +918000XXXXXX range (unallocated Indian D系列 numbers).
 */

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

let numberCounter = 100;

const INDIAN_CITIES = [
  { city: "Mumbai", code: "22" },
  { city: "Delhi", code: "11" },
  { city: "Bangalore", code: "80" },
  { city: "Hyderabad", code: "40" },
  { city: "Chennai", code: "44" },
  { city: "Kolkata", code: "33" },
  { city: "Pune", code: "20" },
  { city: "Ahmedabad", code: "79" },
  { city: "Jaipur", code: "141" },
  { city: "Lucknow", code: "522" },
];

/**
 * Generate a fake Indian phone number in the +918000XXXXXX range.
 * This range is reserved for demo/testing and won't conflict with real numbers.
 */
function generateIndianNumber(region?: string): string {
  const n = ++numberCounter;
  const suffix = String(n).padStart(6, "0");
  return `+918000${suffix}`;
}

export class DemoPhoneProvider implements PhoneProvider {
  readonly name = "demo";

  private numbers: PhoneNumberInfo[] = [
    {
      id: "demo-num-1",
      phoneNumber: "+918000000001",
      provider: "demo",
      capabilities: ["voice", "sms"],
      region: "Mumbai",
      price: "₹0/mo (demo)",
    },
    {
      id: "demo-num-2",
      phoneNumber: "+918000000002",
      provider: "demo",
      capabilities: ["voice", "sms"],
      region: "Delhi",
      price: "₹0/mo (demo)",
    },
  ];

  isConfigured(): boolean {
    return true;
  }

  getConfig(): PhoneProviderConfig {
    return {
      name: "Demo Simulator",
      configured: true,
    };
  }

  async listNumbers(options?: ListPhoneNumbersOptions): Promise<ListPhoneNumbersResult> {
    return { numbers: this.numbers };
  }

  async purchaseNumber(options?: PurchasePhoneOptions): Promise<PurchasePhoneResult> {
    const region = options?.region || "Mumbai";
    const newNumber: PhoneNumberInfo = {
      id: `demo-num-${Date.now()}`,
      phoneNumber: generateIndianNumber(region),
      provider: "demo",
      capabilities: ["voice", "sms"],
      region,
      price: "₹0/mo (demo)",
    };

    this.numbers.push(newNumber);

    logger.info({ phoneNumber: newNumber.phoneNumber, region }, "📞 [DEMO] Phone number purchased");

    return {
      success: true,
      phoneNumber: newNumber,
      message: `Demo number ${newNumber.phoneNumber} assigned successfully`,
    };
  }

  async releaseNumber(phoneNumberId: string): Promise<boolean> {
    const idx = this.numbers.findIndex((n) => n.id === phoneNumberId);
    if (idx !== -1) {
      this.numbers.splice(idx, 1);
      logger.info({ phoneNumberId }, "📞 [DEMO] Phone number released");
    }
    return true;
  }

  async getNumber(phoneNumberId: string): Promise<PhoneNumberInfo | null> {
    return this.numbers.find((n) => n.id === phoneNumberId) || null;
  }
}

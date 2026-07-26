import type {
  PhoneNumberInfo,
  PurchasePhoneOptions,
  PurchasePhoneResult,
  ListPhoneNumbersOptions,
  ListPhoneNumbersResult,
  PhoneProviderConfig,
} from "./types";

/**
 * PhoneProvider — Generic interface for telephony providers.
 * 
 * Implementations:
 * - TwilioPhoneProvider  — Direct Twilio API for number purchasing/management
 * - OmnidimensionPhoneProvider — Via Omnidimension's API (legacy/default)
 * - ExotelPhoneProvider  — Via Exotel API
 */
export interface PhoneProvider {
  /** Provider name (e.g. "twilio", "omnidimension") */
  readonly name: string;

  /** Check if provider credentials are configured */
  isConfigured(): boolean;

  /** Get provider config info */
  getConfig(): PhoneProviderConfig;

  /** List available phone numbers */
  listNumbers(options?: ListPhoneNumbersOptions): Promise<ListPhoneNumbersResult>;

  /** Purchase a new phone number */
  purchaseNumber(options?: PurchasePhoneOptions): Promise<PurchasePhoneResult>;

  /** Release/detach a phone number */
  releaseNumber(phoneNumberId: string): Promise<boolean>;

  /** Get details about a specific number */
  getNumber(phoneNumberId: string): Promise<PhoneNumberInfo | null>;
}

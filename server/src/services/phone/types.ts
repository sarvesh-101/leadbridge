/**
 * Phone Provider — Abstraction Layer for Telephony Services
 * 
 * Supports multiple providers: Twilio, Omnidimension, Exotel
 * Users can switch providers by setting PHONE_PROVIDER in .env
 */

export interface PhoneNumberInfo {
  id: string;
  phoneNumber: string;
  provider: string;
  capabilities?: string[];
  region?: string;
  price?: string;
}

export interface PurchasePhoneOptions {
  region?: string;
  areaCode?: string;
  phoneNumber?: string;         // For importing an existing number
}

export interface PurchasePhoneResult {
  success: boolean;
  phoneNumber?: PhoneNumberInfo;
  message: string;
}

export interface ListPhoneNumbersOptions {
  page?: number;
  pageSize?: number;
  region?: string;
}

export interface ListPhoneNumbersResult {
  numbers: PhoneNumberInfo[];
  total?: number;
}

export interface PhoneProviderConfig {
  name: string;
  configured: boolean;
}

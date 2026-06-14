/**
 * Normalize Indian phone numbers to E.164 format (+91XXXXXXXXXX)
 */

export function normalizePhone(input: string): string {
  // Remove all non-digit characters
  let cleaned = input.replace(/\D/g, "");

  // Remove leading 0 or 91 or +91 if present
  if (cleaned.startsWith("+91")) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }

  // Must be exactly 10 digits
  if (cleaned.length !== 10) {
    throw new Error(`Invalid phone number: ${input} (normalized to ${cleaned}, length ${cleaned.length})`);
  }

  // Validate starts with 6-9 (Indian mobile prefix)
  if (!/^[6-9]/.test(cleaned)) {
    throw new Error(`Invalid Indian mobile number: ${input}`);
  }

  return `+91${cleaned}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 10) return phone;
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length >= 10) {
    const last4 = normalized.slice(-4);
    return `+91 ••••• ${last4}`;
  }
  return phone;
}

export function isValidPhone(input: string): boolean {
  try {
    normalizePhone(input);
    return true;
  } catch {
    return false;
  }
}

export function getCountryCode(phone: string): string {
  if (phone.startsWith("+91")) return "IN";
  if (phone.startsWith("+1")) return "US";
  return "IN";
}

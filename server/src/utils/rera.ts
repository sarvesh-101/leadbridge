/**
 * V2 (T13) — RERA registration numbers.
 *
 * A RERA number identifies a registered real-estate agent/broker. One active
 * Converza account per RERA number stops the same registered business (or a
 * reseller) from farming multiple trials. Format is state-specific, so we only
 * enforce the shared shape: 8–24 alphanumerics, case-insensitive, separators
 * ignored ("A51900001234", "A519 0000 1234").
 */
export function normalizeReraNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.replace(/[\s-]/g, "").toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9]{8,24}$/.test(normalized)) {
    throw new Error(
      "RERA number must be 8–24 letters/digits (separators are ignored), e.g. A51900001234."
    );
  }
  return normalized;
}

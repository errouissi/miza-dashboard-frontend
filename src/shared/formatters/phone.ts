import { ABSENT } from "./absent";

/**
 * Phone numbers (Design System §5, data formatting).
 *
 * Grouped for reading, never an unbroken digit run — grouping is what makes a number
 * checkable against a paper form. Moroccan convention: `06 12 34 56 78`.
 *
 * Formatting is applied at RENDER only. The stored and copied value stays canonical,
 * so copying a phone number yields something dialable rather than something pretty.
 * Never truncated: a partial phone number is useless, and it is a primary search key.
 */

/** The canonical value: digits (and a leading +) only. Use this for copy and search. */
export function toCanonicalPhone(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value.replace(/[^\d+]/g, "");
  return cleaned === "" ? null : cleaned;
}

/** Groups digits in pairs for reading. Unknown shapes are shown as-is, never mangled. */
export function formatPhone(value: string | null | undefined): string {
  const canonical = toCanonicalPhone(value);
  if (!canonical) return ABSENT;

  const international = canonical.startsWith("+");
  const digits = international ? canonical.slice(1) : canonical;

  // Local Moroccan mobile/landline: 10 digits, grouped 0X XX XX XX XX.
  if (!international && digits.length === 10) {
    const pairs = digits.slice(2).match(/\d{2}/g) ?? [];
    return [digits.slice(0, 2), ...pairs].join(" ");
  }

  // Anything else: group in pairs from the left rather than guessing at a scheme
  // we do not know. Readable, and it never corrupts the value.
  const grouped = (digits.match(/\d{1,2}/g) ?? []).join(" ");
  return international ? `+${grouped}` : grouped;
}

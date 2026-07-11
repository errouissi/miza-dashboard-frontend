import { ABSENT } from "./absent";

/**
 * Identifiers (Design System §5, data formatting).
 *
 * CIN, cheque numbers, receipt numbers, account numbers, reference codes: these are
 * TEXT, not numbers.
 *
 * No thousands separators, no rounding, no locale formatting, no arithmetic. An
 * identifier that picks up a space separator has been silently corrupted on screen —
 * a cheque number rendered as "1 234 567" is not the cheque number.
 *
 * The type system cannot prevent someone passing a cheque number through formatMoney,
 * so this function exists to be the obvious, named alternative.
 */

export function formatIdentifier(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return ABSENT;

  // Numbers reach us from the API as numbers sometimes; stringify them raw. Never
  // via a locale-aware path, which is exactly what would insert a separator.
  return String(value);
}

/**
 * Middle-truncates a long identifier, keeping the head and tail (Design System §27):
 * beginnings and ends are what discriminate one identifier from another. The full
 * value MUST remain available on hover — the caller is responsible for that.
 */
export function truncateIdentifier(
  value: string | number | null | undefined,
  maxLength = 16,
): string {
  const text = formatIdentifier(value);
  if (text === ABSENT || text.length <= maxLength) return text;

  const keep = Math.max(2, Math.floor((maxLength - 1) / 2));
  return `${text.slice(0, keep)}…${text.slice(-keep)}`;
}

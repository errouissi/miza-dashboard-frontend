import { ABSENT } from "./absent";

/**
 * Dates (Design System §5, §27).
 *
 * ONE absolute format everywhere: `DD/MM/YYYY`, timestamps `DD/MM/YYYY HH:mm` (24h).
 * Never locale-inferred from the browser — an operator in a differently-configured
 * browser must not see a different date than the colleague beside them.
 *
 * RELATIVE DATES ARE NOT IMPLEMENTED HERE, deliberately. They are French copy
 * ("il y a 2 h") and the interface-language decision (O-1) is unsigned. They are also
 * forbidden for deadlines and financial dates regardless (§27): "il y a 2 jours" is
 * not a date you can put on a cheque.
 */

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** `DD/MM/YYYY`. Absent or unparseable renders as the absent dash. */
export function formatDate(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return ABSENT;

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * `DD/MM/YYYY HH:mm`, 24-hour. Used only where the time genuinely matters — audit
 * trails and deadlines — not sprinkled onto every business date.
 */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return ABSENT;

  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `YYYY-MM-DD` — the wire format for date inputs and query params, never for display. */
export function toIsoDate(
  value: Date | string | number | null | undefined,
): string | null {
  const date = toDate(value);
  if (!date) return null;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

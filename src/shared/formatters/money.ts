import { ABSENT } from "./absent";

/**
 * Money (Design System §5).
 *
 * Moroccan French format: space as thousands separator, comma as decimal, ALWAYS
 * two decimals, currency after the amount — `12 500,00 DH`.
 *
 * THE RULE THAT MATTERS MOST:
 *   Absent is not zero. A missing value renders as `—`, never as `0,00 DH`.
 *   On screens that settle real debts that distinction is financial, not cosmetic:
 *   "we have no figure for this" and "this agent owes nothing" are opposite facts,
 *   and only one of them means someone still has work to do.
 *
 * This module is the SOLE implementation. No component formats an amount inline —
 * a single `value.toFixed(2)` in one table silently breaks the rule above, in one
 * place, invisibly, and nobody finds it until an operator acts on a zero that was
 * really a null.
 */

const CURRENCY_SUFFIX = "DH";
/** U+00A0 — a normal space would let the amount wrap away from its currency. */
const NBSP = " ";
/** U+2212 — a true minus sign, not a hyphen (Design System §5). */
const MINUS = "−";

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** Formats an amount. `null`/`undefined`/NaN render as the absent dash. */
export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return ABSENT;

  const negative = amount < 0;
  const [whole, fraction] = Math.abs(amount).toFixed(2).split(".");

  const body = `${groupThousands(whole)},${fraction}${NBSP}${CURRENCY_SUFFIX}`;
  return negative ? `${MINUS}${body}` : body;
}

/**
 * The amount without its currency suffix — for a Money input, whose "DH" is a fixed
 * affix inside the field rather than part of the value (Design System §12).
 */
export function formatMoneyValue(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "";

  const negative = amount < 0;
  const [whole, fraction] = Math.abs(amount).toFixed(2).split(".");
  const body = `${groupThousands(whole)},${fraction}`;
  return negative ? `${MINUS}${body}` : body;
}

/**
 * Parses operator input back to a number. Paste-tolerant by design (§12): accepts
 * "12 500,00" and "12500.00", and the non-breaking spaces our own formatter emits.
 * Returns null when the input is not a number — never 0, which would invent a value.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input
    .replace(new RegExp(`[${NBSP}\\s]`, "g"), "")
    .replace(MINUS, "-")
    .replace(CURRENCY_SUFFIX, "")
    .replace(",", ".")
    .trim();

  if (cleaned === "" || cleaned === "-") return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

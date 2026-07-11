/**
 * The sole implementation of the Design System's data-formatting rules (§5, §27).
 *
 * MUST: no component formats a value inline. No `toFixed(2)` in a table cell, no date
 * string built by hand, ever. Centralising these makes the rules impossible to break
 * by accident, and makes the interface-language decision (O-1) revisable in one place
 * rather than three hundred.
 *
 * Deferred, and deliberately so:
 *   - relative dates ("il y a 2 h") — French copy, blocked on O-1
 *   - percentages and large-number abbreviation — no caller yet (FTA D-11)
 */
export { ABSENT } from "./absent";
export { formatMoney, formatMoneyValue, parseMoney } from "./money";
export { formatDate, formatDateTime, toIsoDate } from "./date";
export { formatPhone, toCanonicalPhone } from "./phone";
export { formatIdentifier, truncateIdentifier } from "./identifier";

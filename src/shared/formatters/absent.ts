/**
 * The absent value (Design System §5, §27).
 *
 * Absent renders as an em-dash in tertiary colour — never as `0`, never as an empty
 * cell, never as "N/A" or "null". Empty and zero are different facts, and only one
 * of them means someone still has work to do.
 *
 * Every formatter in this module returns this for a missing value, so the rule holds
 * for money, dates, phones and identifiers identically.
 */
export const ABSENT = "—";

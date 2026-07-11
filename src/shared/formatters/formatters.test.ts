import { describe, expect, it } from "vitest";
import { ABSENT } from "./absent";
import { formatMoney, formatMoneyValue, parseMoney } from "./money";
import { formatDate, formatDateTime, toIsoDate } from "./date";
import { formatPhone, toCanonicalPhone } from "./phone";
import { formatIdentifier, truncateIdentifier } from "./identifier";

/** Design System §5/§27, as an executable specification. */

const NBSP = " ";
const MINUS = "−";

describe("formatMoney", () => {
  it("uses Moroccan French format: space thousands, comma decimal, DH suffix", () => {
    expect(formatMoney(12500)).toBe(`12${NBSP}500,00${NBSP}DH`);
    expect(formatMoney(1234567.5)).toBe(`1${NBSP}234${NBSP}567,50${NBSP}DH`);
  });

  it("always shows two decimals", () => {
    expect(formatMoney(5)).toBe(`5,00${NBSP}DH`);
    expect(formatMoney(0.5)).toBe(`0,50${NBSP}DH`);
  });

  it("renders ABSENT as an em-dash — NEVER as 0,00 DH", () => {
    // The load-bearing rule of the whole module. "We have no figure" and "this agent
    // owes nothing" are opposite facts, and only one means someone still has work to do.
    expect(formatMoney(null)).toBe(ABSENT);
    expect(formatMoney(undefined)).toBe(ABSENT);
    expect(formatMoney(NaN)).toBe(ABSENT);

    expect(formatMoney(null)).not.toBe(`0,00${NBSP}DH`);
  });

  it("renders zero as zero — zero is a real amount", () => {
    expect(formatMoney(0)).toBe(`0,00${NBSP}DH`);
  });

  it("uses a true minus sign for negatives", () => {
    expect(formatMoney(-1500)).toBe(`${MINUS}1${NBSP}500,00${NBSP}DH`);
  });

  it("formats a bare value for money inputs (no suffix)", () => {
    expect(formatMoneyValue(12500)).toBe(`12${NBSP}500,00`);
    expect(formatMoneyValue(null)).toBe("");
  });

  it("parses operator input paste-tolerantly, and never invents a zero", () => {
    expect(parseMoney("12 500,00")).toBe(12500);
    expect(parseMoney(`12${NBSP}500,00${NBSP}DH`)).toBe(12500);
    expect(parseMoney("12500.00")).toBe(12500);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("formatDate", () => {
  const date = new Date(2026, 6, 12, 14, 5); // 12/07/2026 14:05

  it("uses DD/MM/YYYY, never a browser locale", () => {
    expect(formatDate(date)).toBe("12/07/2026");
  });

  it("adds 24h time for timestamps", () => {
    expect(formatDateTime(date)).toBe("12/07/2026 14:05");
  });

  it("renders ABSENT for missing or unparseable values", () => {
    expect(formatDate(null)).toBe(ABSENT);
    expect(formatDate("")).toBe(ABSENT);
    expect(formatDate("not-a-date")).toBe(ABSENT);
    expect(formatDateTime(undefined)).toBe(ABSENT);
  });

  it("emits ISO for the wire, not for display", () => {
    expect(toIsoDate(date)).toBe("2026-07-12");
    expect(toIsoDate(null)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups a Moroccan mobile for reading", () => {
    expect(formatPhone("0612345678")).toBe("06 12 34 56 78");
  });

  it("keeps the canonical value dialable for copy and search", () => {
    expect(toCanonicalPhone("06 12 34 56 78")).toBe("0612345678");
    expect(toCanonicalPhone("+212 612345678")).toBe("+212612345678");
  });

  it("never mangles an unknown shape", () => {
    expect(formatPhone("+212612345678")).toContain("+");
  });

  it("renders ABSENT for a missing number", () => {
    expect(formatPhone(null)).toBe(ABSENT);
    expect(formatPhone("")).toBe(ABSENT);
  });
});

describe("formatIdentifier", () => {
  it("NEVER applies thousands separators to an identifier", () => {
    // A cheque number rendered as "1 234 567" is not the cheque number.
    expect(formatIdentifier(1234567)).toBe("1234567");
    expect(formatIdentifier("CIN-1234567")).toBe("CIN-1234567");
    expect(formatIdentifier(1234567)).not.toContain(NBSP);
  });

  it("renders ABSENT for a missing identifier", () => {
    expect(formatIdentifier(null)).toBe(ABSENT);
    expect(formatIdentifier("")).toBe(ABSENT);
  });

  it("middle-truncates, keeping head and tail", () => {
    const truncated = truncateIdentifier("ABCDEFGHIJKLMNOPQRSTUV", 11);
    expect(truncated).toContain("…");
    expect(truncated.startsWith("ABCDE")).toBe(true);
    expect(truncated.endsWith("RSTUV")).toBe(true);
  });

  it("leaves a short identifier alone", () => {
    expect(truncateIdentifier("CH-001")).toBe("CH-001");
  });
});

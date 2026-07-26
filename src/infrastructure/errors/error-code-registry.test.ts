import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";
import { ERROR_CODES, resolveErrorDisplay } from "./error-code-registry";

describe("error-code registry", () => {
  it("degrades gracefully for an unregistered code, still surfacing the code", () => {
    // Entries are empty until O-1 is signed, so EVERY code is unregistered today.
    // The fallback is therefore the only path that runs — and it must never produce
    // a blank screen. An unknown failure degrades to "unhelpful but diagnosable".
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "ALLOCATION_STOCK_INSUFFICIENT",
        requestId: "req-9",
      }),
    );

    expect(display.message).toBeUndefined(); // copy is owned by the copy layer (O-1)
    expect(display.code).toBe("ALLOCATION_STOCK_INSUFFICIENT"); // quotable to support
    expect(display.requestId).toBe("req-9");
    expect(display.tone).toBe("danger"); // a failure is never "info"
  });

  it("carries the correlation reference even when there is no code", () => {
    const display = resolveErrorDisplay(
      new AppError({ kind: "server", requestId: "req-5" }),
    );

    expect(display.code).toBeUndefined();
    expect(display.requestId).toBe("req-5");
    expect(display.tone).toBe("danger");
  });
});

describe("Agent Stock Return codes (roadmap M5, Phase 1) — the first real population", () => {
  // Exact membership, mirroring the backend's own registry-testing
  // discipline (Phase-4A-HTTP-Inv-5: exact membership, never a wildcard
  // probe) — a code renamed or removed on either side is a real drift this
  // test is meant to catch.
  it("registers exactly the 13 codes AgentStockReturnExceptionRenderer emits", () => {
    const returnCodes = Object.keys(ERROR_CODES).filter((code) =>
      code.startsWith("RETURN_"),
    );

    expect(returnCodes.sort()).toEqual(
      [
        "RETURN_NOT_DRAFT",
        "RETURN_HAS_NO_LINES",
        "RETURN_NOT_EDITABLE",
        "RETURN_STOCK_INSUFFICIENT",
        "RETURN_RECIPIENT_BINDING_MISMATCH",
        "RETURN_MANAGER_ROLE_INVALID",
        "RETURN_COMMERCIAL_ROLE_INVALID",
        "RETURN_MANAGER_INACTIVE",
        "RETURN_COMMERCIAL_INACTIVE",
        "RETURN_LINE_DUPLICATE_PRODUCT",
        "RETURN_NUMBER_DUPLICATE",
        "RETURN_NOT_FOUND",
        "RETURN_LINE_NOT_FOUND",
      ].sort(),
    );
  });

  it("resolves a registered code to real copy and the correct tone", () => {
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "RETURN_STOCK_INSUFFICIENT",
        requestId: "req-1",
      }),
    );

    expect(display.message).toBe(
      "The commercial does not hold enough stock of this product to return the requested quantity.",
    );
    expect(display.tone).toBe("danger");
    expect(display.recovery).toBeUndefined();
  });

  it("has no registered recovery path for any RETURN_* code yet", () => {
    const returnEntries = Object.entries(ERROR_CODES).filter(([code]) =>
      code.startsWith("RETURN_"),
    );

    for (const [, entry] of returnEntries) {
      expect(entry.recovery).toBeUndefined();
    }
  });
});

describe("Agent Transfer codes (roadmap M5, Phase 2) — registered explicitly, not derived from Return's", () => {
  // `.includes("TRANSFER")`, not `.startsWith("TRANSFER_")` — one code
  // (`AGENT_TRANSFER_EXCEEDS_CAPACITY`) genuinely uses a different prefix,
  // confirmed from source, not a typo to normalize away.
  it("registers exactly the 15 codes AgentTransferExceptionRenderer emits", () => {
    const transferCodes = Object.keys(ERROR_CODES).filter((code) =>
      code.includes("TRANSFER"),
    );

    expect(transferCodes.sort()).toEqual(
      [
        "TRANSFER_NOT_DRAFT",
        "TRANSFER_HAS_NO_LINES",
        "TRANSFER_NOT_EDITABLE",
        "AGENT_TRANSFER_EXCEEDS_CAPACITY",
        "TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION",
        "TRANSFER_STOCK_INSUFFICIENT",
        "TRANSFER_RECIPIENT_BINDING_MISMATCH",
        "TRANSFER_RECIPIENT_MANAGER_ROLE_INVALID",
        "TRANSFER_RECIPIENT_COMMERCIAL_ROLE_INVALID",
        "TRANSFER_RECIPIENT_MANAGER_INACTIVE",
        "TRANSFER_RECIPIENT_COMMERCIAL_INACTIVE",
        "TRANSFER_LINE_DUPLICATE_PRODUCT",
        "TRANSFER_NUMBER_DUPLICATE",
        "TRANSFER_NOT_FOUND",
        "TRANSFER_LINE_NOT_FOUND",
      ].sort(),
    );
  });

  // Confirms the two codes have GENUINELY DIFFERENT strings from their
  // nearest Return equivalent, not a mechanical rename — the concrete
  // regression this test guards against.
  it("does not confuse TRANSFER_RECIPIENT_MANAGER_ROLE_INVALID with Return's own (unprefixed) equivalent", () => {
    expect(ERROR_CODES["TRANSFER_RECIPIENT_MANAGER_ROLE_INVALID"]).toBeDefined();
    expect(ERROR_CODES["TRANSFER_MANAGER_ROLE_INVALID"]).toBeUndefined();
  });

  it("resolves the capacity-exceeded code to real copy", () => {
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "AGENT_TRANSFER_EXCEEDS_CAPACITY",
        requestId: "req-2",
      }),
    );

    expect(display.message).toBe(
      "This transfer's amount exceeds the commercial's remaining grattage capacity.",
    );
    expect(display.tone).toBe("danger");
  });

  it("resolves the outstanding-obligation (restock gate) code to real copy, with no recovery path yet", () => {
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION",
        requestId: "req-3",
      }),
    );

    expect(display.message).toBe(
      "The selected commercial has an outstanding grattage obligation and cannot receive new stock yet.",
    );
    expect(display.recovery).toBeUndefined();
  });

  it("has no registered recovery path for any TRANSFER_*/AGENT_TRANSFER_* code yet", () => {
    const transferEntries = Object.entries(ERROR_CODES).filter(([code]) =>
      code.includes("TRANSFER"),
    );

    for (const [, entry] of transferEntries) {
      expect(entry.recovery).toBeUndefined();
    }
  });
});

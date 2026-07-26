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

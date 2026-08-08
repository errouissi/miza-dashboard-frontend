import { describe, expect, it } from "vitest";
import { AppError } from "./app-error";
import { ERROR_CODES, resolveErrorDisplay } from "./error-code-registry";

describe("error-code registry", () => {
  it("degrades gracefully for an unregistered code, still surfacing the code", () => {
    // A genuinely fake code, deliberately not a real backend constant — every
    // Stock/Money code registered so far (Return/Transfer/Allocation) is real,
    // so this test must not borrow one of them: a future phase registering
    // the "next" resource's codes would otherwise silently break this test's
    // own premise. The fallback must never produce a blank screen regardless
    // of which codes happen to be registered today.
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "SOME_UNREGISTERED_CODE",
        requestId: "req-9",
      }),
    );

    expect(display.message).toBeUndefined(); // copy is owned by the copy layer (O-1)
    expect(display.code).toBe("SOME_UNREGISTERED_CODE"); // quotable to support
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

describe("Allocation codes (roadmap M5, Phase 4) — fewer than Return's/Transfer's own, by contract, not omission", () => {
  it("registers exactly the 9 codes AllocationExceptionRenderer emits (backend commit 9af5d00 removed ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION)", () => {
    const allocationCodes = Object.keys(ERROR_CODES).filter((code) =>
      code.startsWith("ALLOCATION_"),
    );

    expect(allocationCodes.sort()).toEqual(
      [
        "ALLOCATION_NOT_DRAFT",
        "ALLOCATION_HAS_NO_LINES",
        "ALLOCATION_NOT_EDITABLE",
        "ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY",
        "ALLOCATION_STOCK_INSUFFICIENT",
        "ALLOCATION_LINE_DUPLICATE_PRODUCT",
        "ALLOCATION_NUMBER_DUPLICATE",
        "ALLOCATION_NOT_FOUND",
        "ALLOCATION_LINE_NOT_FOUND",
      ].sort(),
    );
  });

  it("no longer registers ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION — the backend can never emit it again", () => {
    expect(ERROR_CODES["ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION"]).toBeUndefined();
  });

  // Allocation has NO role-mismatch/inactive/binding-drift family
  // (`ALLOCATION_MANAGER_ROLE_INVALID` etc.) — its binding pair is
  // validated by plain FormRequest `exists()` rules, not a domain
  // exception, a genuine divergence from Return's/Transfer's own.
  it("has no role-mismatch or inactive-recipient code family, unlike Return/Transfer", () => {
    expect(ERROR_CODES["ALLOCATION_MANAGER_ROLE_INVALID"]).toBeUndefined();
    expect(ERROR_CODES["ALLOCATION_COMMERCIAL_ROLE_INVALID"]).toBeUndefined();
    expect(ERROR_CODES["ALLOCATION_MANAGER_INACTIVE"]).toBeUndefined();
    expect(ERROR_CODES["ALLOCATION_RECIPIENT_BINDING_MISMATCH"]).toBeUndefined();
  });

  it("resolves the deposit-capacity-exceeded code to real copy", () => {
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY",
        requestId: "req-4",
      }),
    );

    expect(display.message).toBe(
      "The manager does not have enough validated grattage-deposit capacity to cover this allocation's amount.",
    );
    expect(display.tone).toBe("danger");
  });

  it("has no registered recovery path for any ALLOCATION_* code yet", () => {
    const allocationEntries = Object.entries(ERROR_CODES).filter(([code]) =>
      code.startsWith("ALLOCATION_"),
    );

    for (const [, entry] of allocationEntries) {
      expect(entry.recovery).toBeUndefined();
    }
  });
});

describe("Bon codes (roadmap M5, Phase 5) — the fifth and final Stock resource, the only one with a cancel lifecycle", () => {
  it("registers exactly the 9 codes BonExceptionRenderer emits", () => {
    const bonCodes = Object.keys(ERROR_CODES).filter((code) => code.startsWith("BON_"));

    expect(bonCodes.sort()).toEqual(
      [
        "BON_NOT_DRAFT",
        "BON_HAS_NO_LINES",
        "BON_NOT_EDITABLE",
        "BON_NOT_CANCELLABLE",
        "BON_CANCEL_STOCK_INSUFFICIENT",
        "BON_LINE_DUPLICATE_PRODUCT",
        "BON_NUMBER_DUPLICATE",
        "BON_NOT_FOUND",
        "BON_LINE_NOT_FOUND",
      ].sort(),
    );
  });

  // No BON_STOCK_INSUFFICIENT exists — validateBon() has no capacity or
  // stock-sufficiency check at all (a bon is the SOURCE of stock). Only
  // cancelling can hit a stock-insufficiency refusal.
  it("has no BON_STOCK_INSUFFICIENT code, unlike every other Stock resource's own validate-time gate", () => {
    expect(ERROR_CODES["BON_STOCK_INSUFFICIENT"]).toBeUndefined();
    expect(ERROR_CODES["BON_CANCEL_STOCK_INSUFFICIENT"]).toBeDefined();
  });

  it("resolves the cancel-stock-insufficient code to real copy", () => {
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "BON_CANCEL_STOCK_INSUFFICIENT",
        requestId: "req-6",
      }),
    );

    expect(display.message).toBe(
      "This bon cannot be cancelled: the stock it brought in has already been used elsewhere.",
    );
    expect(display.tone).toBe("danger");
  });

  it("has no registered recovery path for any BON_* code yet", () => {
    const bonEntries = Object.entries(ERROR_CODES).filter(([code]) =>
      code.startsWith("BON_"),
    );

    for (const [, entry] of bonEntries) {
      expect(entry.recovery).toBeUndefined();
    }
  });
});

describe("COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN (M7 Agent 360 completion item)", () => {
  it("resolves to real copy, danger tone, no recovery path", () => {
    const display = resolveErrorDisplay(
      new AppError({
        kind: "domain",
        code: "COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN",
        requestId: "req-7",
      }),
    );

    expect(display.message).toBe(
      "This commercial still holds stock and cannot be reassigned to another manager until it is returned or cleared.",
    );
    expect(display.tone).toBe("danger");
    expect(display.recovery).toBeUndefined();
  });
});

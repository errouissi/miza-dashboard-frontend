import { describe, expect, it } from "vitest";
import { assertSafeE2eStatus, E2eSafetyError } from "./status-validate";

/**
 * M8 Phase 1A negative safety validation (ADR-0042) — proves the isolation
 * gate fails closed on every unsafe response shape, without needing a real
 * network call or touching the actual backend/database state. The real
 * Playwright run itself exercises this same function against the live,
 * healthy /e2e/status response (see e2e/global-setup.ts).
 */
const SAFE_BODY = {
  environment: "e2e",
  database_isolated: true,
  database_connected: true,
};

describe("assertSafeE2eStatus", () => {
  it("accepts the exact safe response", () => {
    expect(() => assertSafeE2eStatus(200, SAFE_BODY)).not.toThrow();
  });

  it("refuses a non-200 HTTP status", () => {
    expect(() => assertSafeE2eStatus(503, SAFE_BODY)).toThrow(E2eSafetyError);
    expect(() => assertSafeE2eStatus(404, SAFE_BODY)).toThrow(/HTTP 404/);
  });

  it("refuses a non-object body", () => {
    expect(() => assertSafeE2eStatus(200, null)).toThrow(E2eSafetyError);
    expect(() => assertSafeE2eStatus(200, "ok")).toThrow(E2eSafetyError);
    expect(() => assertSafeE2eStatus(200, undefined)).toThrow(E2eSafetyError);
  });

  it('refuses environment !== "e2e"', () => {
    expect(() =>
      assertSafeE2eStatus(200, { ...SAFE_BODY, environment: "local" }),
    ).toThrow(/environment/);
    expect(() =>
      assertSafeE2eStatus(200, { ...SAFE_BODY, environment: "production" }),
    ).toThrow(/environment/);
  });

  it("refuses database_isolated !== true", () => {
    expect(() =>
      assertSafeE2eStatus(200, { ...SAFE_BODY, database_isolated: false }),
    ).toThrow(/database_isolated/);
  });

  it("refuses database_connected !== true", () => {
    expect(() =>
      assertSafeE2eStatus(200, { ...SAFE_BODY, database_connected: false }),
    ).toThrow(/database_connected/);
  });

  it("refuses a response missing required fields entirely", () => {
    expect(() => assertSafeE2eStatus(200, {})).toThrow(E2eSafetyError);
  });
});

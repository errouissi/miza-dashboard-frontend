/**
 * M8 Phase 1A (ADR-0042) — validates the backend's GET /e2e/status response.
 * Reaching this endpoint at all already proves the backend's own boot-time
 * database-name guard passed (see the backend's docs/e2e-testing.md); this
 * validator is the frontend's own independent check on top of that, so a
 * malformed or unexpected response is treated as unsafe rather than ignored.
 *
 * A pure function, deliberately separate from the fetch call itself
 * (e2e/global-setup.ts), so the failure conditions are unit-testable without
 * a real network call — see status-validate.test.ts.
 */

export type E2eStatusResponse = {
  environment: "e2e";
  database_isolated: true;
  database_connected: true;
};

export class E2eSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "E2eSafetyError";
  }
}

/**
 * Throws unless the response is EXACTLY the safe, isolated shape. No field
 * is optional and no other value is accepted — this is a safety gate, not a
 * best-effort parse.
 */
export function assertSafeE2eStatus(
  httpStatus: number,
  body: unknown,
): asserts body is E2eStatusResponse {
  if (httpStatus !== 200) {
    throw new E2eSafetyError(
      `E2E safety check failed: GET /e2e/status returned HTTP ${httpStatus}, expected 200. ` +
        `Refusing to run — the isolated E2E backend may be down, misconfigured, or its ` +
        `database unreachable.`,
    );
  }

  if (typeof body !== "object" || body === null) {
    throw new E2eSafetyError(
      "E2E safety check failed: GET /e2e/status did not return a JSON object. Refusing to run.",
    );
  }

  const candidate = body as Record<string, unknown>;

  if (candidate.environment !== "e2e") {
    throw new E2eSafetyError(
      `E2E safety check failed: /e2e/status reported environment=${JSON.stringify(candidate.environment)}, ` +
        `expected "e2e". Refusing to run.`,
    );
  }

  if (candidate.database_isolated !== true) {
    throw new E2eSafetyError(
      "E2E safety check failed: /e2e/status reported database_isolated !== true. Refusing to " +
        "run — this backend instance may not be attached to the isolated E2E database.",
    );
  }

  if (candidate.database_connected !== true) {
    throw new E2eSafetyError(
      "E2E safety check failed: /e2e/status reported database_connected !== true. Refusing " +
        "to run — the isolated E2E database is unreachable from this backend instance.",
    );
  }
}

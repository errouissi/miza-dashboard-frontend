import { loadE2eEnv } from "./env";
import { assertSafeE2eStatus } from "./status-validate";

/**
 * M8 Phase 1A authoritative isolation gate (ADR-0042). Playwright runs this
 * once before any test file and before any browser opens. It calls the
 * already-running isolated backend's own preflight endpoint and refuses to
 * proceed unless it proves environment + database isolation + live
 * connectivity — see the backend's docs/e2e-testing.md and
 * e2e/status-validate.ts for the exact contract enforced.
 *
 * This does not start the backend — it is an explicit external prerequisite
 * (Backend Team owned) that must already be running on port 8010.
 */
export default async function globalSetup(): Promise<void> {
  const { apiBaseUrl } = loadE2eEnv();
  const statusUrl = `${apiBaseUrl}/e2e/status`;

  let response: Response;
  try {
    response = await fetch(statusUrl);
  } catch (cause) {
    throw new Error(
      `E2E safety check failed: could not reach ${statusUrl} (${String(cause)}). Refusing to ` +
        `run — start the isolated E2E backend on port 8010 first (see docs/e2e-testing.md).`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  assertSafeE2eStatus(response.status, body);

  console.log("[e2e] Isolation preflight passed:", body);
}

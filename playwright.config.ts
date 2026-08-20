import { defineConfig, devices } from "@playwright/test";
import { loadE2eEnv } from "./e2e/env";

/**
 * M8 Phase 1A (ADR-0042) — Chromium-only, one smoke test, real backend.
 *
 * Fails closed at config-load time, before Playwright starts anything (webServer,
 * globalSetup, or a browser) — see e2e/env.ts. The authoritative backend isolation
 * check (GET /e2e/status) runs in globalSetup, also before any browser opens.
 */
loadE2eEnv();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // The isolated backend on :8010 is an explicit external prerequisite
  // (Backend Team owned) — never started from here. Only the frontend's own
  // Vite dev server is managed by Playwright.
  webServer: {
    // --host 127.0.0.1 is load-bearing, not decorative: with no --host, Vite
    // resolves "localhost" and binds only [::1] on this machine (confirmed
    // by diagnostic — curl to 127.0.0.1:5173 got no connection while the
    // server was demonstrably up on ::1). Playwright's own readiness probe
    // and `url`/`use.baseURL` below are IPv4 literals, so an IPv6-only bind
    // is invisible to them and the webServer step times out even though
    // Vite itself started in under a second. Explicit host removes the
    // ambiguity instead of widening the probe or the timeout.
    command: "pnpm exec vite --mode e2e --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    // Never reuse an already-running server on 5173 — it could be a normal
    // dev server pointed at the shared dev backend, which would silently
    // bypass the E2E environment guard entirely.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * M8 Phase 1A (ADR-0042) — the Node-side counterpart of
 * src/infrastructure/config/env.ts. Loads and validates .env.e2e for the
 * Playwright test runner itself (playwright.config.ts, e2e/global-setup.ts,
 * e2e/fixtures/login.ts) — a separate process from the Vite-served app, so
 * it needs its own fail-closed read of the same file.
 *
 * Deliberately reads ONLY .env.e2e — no process.env merge, no default
 * fallback. A single source of truth is the point: this guard exists so a
 * stray shell variable or a missing file cannot silently let E2E target the
 * wrong backend.
 */

const REQUIRED_API_BASE_URL = "http://127.0.0.1:8010/api/v1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_E2E_PATH = path.resolve(__dirname, "../.env.e2e");

export type E2eEnv = {
  apiBaseUrl: string;
  adminEmail: string;
  adminPassword: string;
};

function parseEnvFile(filePath: string): Record<string, string> {
  const raw = readFileSync(filePath, "utf-8");
  const values: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return values;
}

/** Fails closed: any missing file, missing value, or mismatched URL throws. */
export function loadE2eEnv(): E2eEnv {
  if (!existsSync(ENV_E2E_PATH)) {
    throw new Error(
      `E2E safety check failed: ${ENV_E2E_PATH} does not exist. ` +
        `Copy .env.e2e.example to .env.e2e and fill in local values before running Playwright.`,
    );
  }

  const values = parseEnvFile(ENV_E2E_PATH);
  const apiBaseUrl = values.VITE_API_BASE_URL;
  const adminEmail = values.E2E_ADMIN_EMAIL;
  const adminPassword = values.E2E_ADMIN_PASSWORD;

  if (apiBaseUrl !== REQUIRED_API_BASE_URL) {
    throw new Error(
      `E2E safety check failed: VITE_API_BASE_URL in .env.e2e must be exactly ` +
        `"${REQUIRED_API_BASE_URL}" (got "${apiBaseUrl ?? "(unset)"}"). Refusing to run — ` +
        `this guard exists specifically so E2E can never silently target the shared dev ` +
        `backend, a different port, or production.`,
    );
  }
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "E2E safety check failed: E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must both be set " +
        "in .env.e2e (see .env.e2e.example).",
    );
  }

  return { apiBaseUrl, adminEmail, adminPassword };
}

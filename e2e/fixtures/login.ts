import type { Page } from "@playwright/test";
import { loadE2eEnv } from "../env";

/**
 * M8 Phase 1A (ADR-0042) — the smallest reusable real-login helper the one
 * approved smoke test needs. Drives the actual login page exactly as an
 * operator would: no direct POST /auth/login call, no manual localStorage
 * injection, no mocked/bypassed auth. Credentials come from .env.e2e
 * (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD) — the existing, unchanged
 * AdminUserSeeder's seeded test admin.
 */
export async function loginAsE2eAdmin(page: Page): Promise<void> {
  const { adminEmail, adminPassword } = loadE2eEnv();

  await page.goto("/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
}

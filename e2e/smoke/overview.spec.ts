import { test, expect } from "@playwright/test";
import { loginAsE2eAdmin } from "../fixtures/login";

/**
 * M8 Phase 1A — the ONE approved smoke test (ADR-0042). Real browser, real
 * login, real Laravel backend, real authenticated Overview render. No
 * mutation, no other page, no second test in this phase — see
 * docs/next-session.md's approved Phase 1A scope before adding another.
 */
test("real login reaches the authenticated Overview page", async ({ page }) => {
  await loginAsE2eAdmin(page);

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
});

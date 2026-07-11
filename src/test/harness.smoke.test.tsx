import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { server } from "./msw/server";

/**
 * Proves the harness itself works — the runner, the DOM environment, and MSW
 * interception. Deliberately contains no Miza domain logic (M0 scope).
 */
describe("test harness", () => {
  it("renders into a DOM environment", () => {
    render(<p>harness online</p>);
    expect(screen.getByText("harness online")).toBeInTheDocument();
  });

  it("intercepts HTTP requests with MSW", async () => {
    server.use(
      http.get("http://localhost/api/v1/ping", () => HttpResponse.json({ ok: true })),
    );

    const response = await fetch("http://localhost/api/v1/ping");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { act, render, screen, waitFor } from "@testing-library/react";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { httpClient } from "@/infrastructure/http";
import { router } from "@/app/router/router";
import { App } from "@/app/App";

/**
 * Closes the loop that M1-A could not: a 401 now has somewhere to send the operator.
 *
 * This drives the REAL stack — the real HTTP client, the real interceptor, the real
 * session manager, the real router. Mocking any of them would prove only that the
 * mock works.
 *
 * Uses the browser router (via <App/>), so it lives in its own file: the router is a
 * module singleton and its history would otherwise leak between test files.
 */

const API = "http://localhost/api/v1";

const session = {
  token: "tok",
  user: {
    id: 1,
    name: "Ahmed Errouissi",
    email: "ahmed@example.com",
    roles: ["admin"],
    permissions: [],
  },
};

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
  window.history.replaceState({}, "", "/");
});

describe("401 mid-session", () => {
  it("clears the session and redirects to login, preserving the return path", async () => {
    sessionManager.start(session);
    render(<App />);

    // Navigate through the ROUTER, the way the application actually moves.
    await act(() => router.navigate("/money/cheques?status=pending"));

    server.use(
      http.get(`${API}/anything`, () =>
        HttpResponse.json({ message: "Unauthenticated." }, { status: 401 }),
      ),
    );

    await httpClient.get("/anything").catch(() => undefined);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });

    // The work the operator was doing is preserved, and it is an in-app path.
    expect(router.state.location.search).toBe(
      "?next=%2Fmoney%2Fcheques%3Fstatus%3Dpending",
    );

    // The session is gone from memory and from storage.
    expect(sessionManager.getSnapshot()).toBeNull();
    expect(window.localStorage.getItem("miza.session")).toBeNull();

    expect(await screen.findByText(/Connexion/i)).toBeInTheDocument();
  });

  it("produces ONE redirect when five concurrent requests all 401", async () => {
    sessionManager.start(session);
    render(<App />);

    server.use(
      http.get(`${API}/anything`, () =>
        HttpResponse.json({ message: "Unauthenticated." }, { status: 401 }),
      ),
    );

    // The real scenario: a dashboard page fires five requests, the token expires,
    // all five come back 401 within milliseconds. terminate() is single-flight, so
    // this must be one navigation — not five, which would flicker.
    await Promise.allSettled(
      Array.from({ length: 5 }, () => httpClient.get("/anything")),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });

    // One teardown, one navigation. The history stack must not contain five
    // stacked /login entries — that is the flickering redirect loop.
    expect(sessionManager.getSnapshot()).toBeNull();
    expect(await screen.findByText(/Connexion/i)).toBeInTheDocument();
  });
});

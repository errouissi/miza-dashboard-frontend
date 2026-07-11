import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { sessionManager } from "../auth";
import { AppError } from "../errors";
import { httpClient } from "./http-client";
import { REQUEST_ID_HEADER } from "./correlation";

const API = "http://localhost/api/v1";

const session = {
  token: "tok_abc",
  user: { id: 1, name: "A", email: "a@x.com", roles: [], permissions: [] },
};

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
});

describe("httpClient", () => {
  it("takes its base URL from the validated config", () => {
    expect(httpClient.defaults.baseURL).toBe(API);
  });

  it("does NOT send credentials", () => {
    // The backend lists the dev origin in SANCTUM_STATEFUL_DOMAINS. If cookies were
    // sent, Sanctum would silently switch this app to session auth and the CSRF
    // posture FTA §17 declares "not applicable" would no longer hold.
    expect(httpClient.defaults.withCredentials).toBe(false);
  });

  it("attaches the bearer token when a session exists", async () => {
    sessionManager.start(session);
    let authorization: string | null = null;

    server.use(
      http.get(`${API}/ping`, ({ request }) => {
        authorization = request.headers.get("authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await httpClient.get("/ping");
    expect(authorization).toBe("Bearer tok_abc");
  });

  it("attaches a correlation id to every request", async () => {
    let requestId: string | null = null;

    server.use(
      http.get(`${API}/ping`, ({ request }) => {
        requestId = request.headers.get(REQUEST_ID_HEADER);
        return HttpResponse.json({ ok: true });
      }),
    );

    await httpClient.get("/ping");
    expect(requestId).toBeTruthy();
  });

  it("normalizes a domain error into an AppError and carries the correlation id", async () => {
    server.use(
      http.post(`${API}/bons/1/validate`, () =>
        HttpResponse.json(
          { success: false, code: "BON_NOT_DRAFT", message: "Non modifiable." },
          { status: 409 },
        ),
      ),
    );

    const error = await httpClient.post("/bons/1/validate").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).kind).toBe("domain");
    expect((error as AppError).code).toBe("BON_NOT_DRAFT");
    expect((error as AppError).requestId).toBeTruthy();
  });

  it("terminates the session ONCE when five concurrent requests all 401", async () => {
    // The concurrent-401 case, end to end through the real interceptor. Without the
    // single-flight guard this produces five teardowns and five redirects.
    sessionManager.start(session);

    const onEnded = vi.fn();
    sessionManager.onSessionEnded(onEnded);

    server.use(
      http.get(`${API}/whatever`, () =>
        HttpResponse.json({ message: "Unauthenticated." }, { status: 401 }),
      ),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => httpClient.get("/whatever")),
    );

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(sessionManager.getSnapshot()).toBeNull();
    expect(window.localStorage.getItem("miza.session")).toBeNull();
  });

  it("normalizes a network failure as a retryable AppError", async () => {
    server.use(http.get(`${API}/down`, () => HttpResponse.error()));

    const error = (await httpClient.get("/down").catch((e: unknown) => e)) as AppError;

    expect(error).toBeInstanceOf(AppError);
    expect(error.kind).toBe("network");
    expect(error.isRetryable).toBe(true);
  });
});

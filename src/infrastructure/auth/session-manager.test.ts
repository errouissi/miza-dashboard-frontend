import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessToken, sessionManager } from "./session-manager";
import type { Session } from "./session-types";

const session: Session = {
  token: "tok_abc",
  user: {
    id: 1,
    name: "Ahmed",
    email: "a@example.com",
    roles: ["admin"],
    permissions: ["villes.view"],
  },
};

beforeEach(() => {
  window.localStorage.clear();
  sessionManager.__resetForTests();
});

describe("sessionManager", () => {
  it("starts a session, exposes it, and persists it", () => {
    sessionManager.start(session);

    expect(sessionManager.getSnapshot()).toEqual(session);
    expect(getAccessToken()).toBe("tok_abc");
    expect(window.localStorage.getItem("miza.session")).toContain("tok_abc");
  });

  it("returns a STABLE snapshot reference between reads", () => {
    // useSyncExternalStore re-renders on every call if the reference changes.
    sessionManager.start(session);
    expect(sessionManager.getSnapshot()).toBe(sessionManager.getSnapshot());
  });

  it("terminate() clears memory, storage and token", () => {
    sessionManager.start(session);
    sessionManager.terminate();

    expect(sessionManager.getSnapshot()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem("miza.session")).toBeNull();
  });

  it("collapses CONCURRENT terminations into a single session-ended event", () => {
    // The real scenario (FTA §11): a dashboard page fires five requests, the token
    // expires, all five come back 401 within milliseconds. Without the single-flight
    // guard this fires five teardowns and five redirects — a flickering navigation
    // loop that is miserable to diagnose and trivial to prevent.
    sessionManager.start(session);

    const onEnded = vi.fn();
    sessionManager.onSessionEnded(onEnded);

    sessionManager.terminate();
    sessionManager.terminate();
    sessionManager.terminate();
    sessionManager.terminate();
    sessionManager.terminate();

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers on start and on the first terminate only", () => {
    const listener = vi.fn();
    sessionManager.subscribe(listener);

    sessionManager.start(session);
    expect(listener).toHaveBeenCalledTimes(1);

    sessionManager.terminate();
    sessionManager.terminate();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("allows a new session after termination (the guard resets)", () => {
    sessionManager.start(session);
    sessionManager.terminate();

    const onEnded = vi.fn();
    sessionManager.onSessionEnded(onEnded);

    sessionManager.start(session);
    sessionManager.terminate();

    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("drops a corrupt persisted session rather than authenticating with it", () => {
    window.localStorage.setItem("miza.session", "{ not json");
    sessionManager.__resetForTests();

    expect(sessionManager.getSnapshot()).toBeNull();
    expect(window.localStorage.getItem("miza.session")).toBeNull();
  });
});

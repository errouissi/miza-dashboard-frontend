import { sessionStore } from "./session-storage";
import type { Session } from "./session-types";

/**
 * The session, as an observable external store (approved Decision 2).
 *
 * Deliberately NOT a React context. A context's Provider would have to live in
 * app/, and domains/ may not import app/ (FTA §4) — so a domain could never read
 * the session without breaking the import matrix. An external store subscribed
 * via useSyncExternalStore satisfies FTA §9's guarantee (one global session,
 * changing only at login and logout) while staying boundary-safe. It also removes
 * a whole bug class: there is no Provider to forget.
 *
 * This module is framework-free on purpose. It knows nothing about React, and
 * nothing about routing — `terminate()` announces that the session ended; the
 * app layer decides that "ended" means "navigate to /login" (FTA §2).
 */

type Listener = () => void;

let current: Session | null = sessionStore.read();

/**
 * Guards the concurrent-401 case (FTA §11). A dashboard page fires several
 * requests at once; when a token expires they ALL fail with 401 within
 * milliseconds. Without this flag each one clears storage and fires an "ended"
 * event, producing N redirects — which shows up as a flickering navigation loop
 * that is miserable to diagnose and trivial to prevent here.
 */
let hasEnded = false;

const stateListeners = new Set<Listener>();
const endListeners = new Set<Listener>();

function notify(listeners: Set<Listener>): void {
  for (const listener of [...listeners]) listener();
}

export const sessionManager = {
  /**
   * Stable snapshot for useSyncExternalStore. The reference only changes when
   * the session actually changes — returning a fresh object each call would
   * re-render every consumer on every tick.
   */
  getSnapshot(): Session | null {
    return current;
  },

  subscribe(listener: Listener): () => void {
    stateListeners.add(listener);
    return () => stateListeners.delete(listener);
  },

  /** Fired exactly once per session end, no matter how many 401s arrived. */
  onSessionEnded(listener: Listener): () => void {
    endListeners.add(listener);
    return () => endListeners.delete(listener);
  },

  /** Establishes a session after a successful login (the login call lives in a domain). */
  start(session: Session): void {
    current = session;
    hasEnded = false;
    sessionStore.write(session);
    notify(stateListeners);
  },

  /**
   * Ends the session. Idempotent and single-flight: the first call tears down and
   * announces; every subsequent call is a no-op until a new session starts.
   */
  terminate(): void {
    if (hasEnded) return;
    hasEnded = true;

    const hadSession = current !== null;
    current = null;
    sessionStore.clear();

    if (hadSession) notify(stateListeners);
    notify(endListeners);
  },

  /** Test-only seam: re-reads persisted state. Not part of the app's runtime flow. */
  __resetForTests(): void {
    current = sessionStore.read();
    hasEnded = false;
    stateListeners.clear();
    endListeners.clear();
  },
};

/** The bearer token for the current session, if any. Read by the HTTP client. */
export function getAccessToken(): string | null {
  return current?.token ?? null;
}

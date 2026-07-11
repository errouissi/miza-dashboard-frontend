import type { Session } from "./session-types";

/**
 * The ONLY module in the application that touches localStorage (FTA §14).
 *
 * Everything else goes through the session manager. That single rule is what
 * makes FTA D-16's accepted risk exitable: migrating to httpOnly cookies is a
 * change to this file, not a search-and-replace across the app.
 *
 * Discovery found the legacy build reading localStorage from `useAuth()` *and*
 * from the header independently — two consumers of an unowned global, which is
 * exactly how a logout leaves a stale user in a dropdown.
 */

const SESSION_KEY = "miza.session";

export type SessionStore = {
  read(): Session | null;
  write(session: Session): void;
  clear(): void;
};

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Session>;
  return (
    typeof candidate.token === "string" &&
    typeof candidate.user === "object" &&
    candidate.user !== null &&
    Array.isArray(candidate.user.permissions)
  );
}

export const sessionStore: SessionStore = {
  read() {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(SESSION_KEY);
    } catch {
      // Storage can be unavailable (privacy mode, disabled cookies). Treat an
      // unreadable store as "no session" rather than crashing the bootstrap.
      return null;
    }
    if (!raw) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSession(parsed)) throw new Error("malformed");
      return parsed;
    } catch {
      // A corrupt payload is worse than none: it would authenticate a request
      // with a half-valid session. Drop it.
      this.clear();
      return null;
    }
  },

  write(session) {
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // Persisting is best-effort; the in-memory session still works for this tab.
    }
  },

  clear() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing to do — the in-memory session is cleared regardless.
    }
  },
};

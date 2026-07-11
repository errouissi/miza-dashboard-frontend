import { useSyncExternalStore } from "react";
import { sessionManager, type Session } from "@/infrastructure/auth";

/**
 * Reads the current session (approved Decision 2).
 *
 * Subscribes to the session store directly — there is no SessionContext and no
 * Provider. That is not a shortcut: a Provider would have to be rendered in app/,
 * and domains/ may not import app/ (FTA §4), so a domain could never read the
 * session without breaking the import matrix. `shared -> infrastructure` is legal,
 * and `domains -> shared` is legal, so the session reaches every layer that needs it
 * without a single boundary violation.
 *
 * It also deletes a bug class outright: there is no Provider to forget to mount.
 */
export function useSession(): Session | null {
  return useSyncExternalStore(
    sessionManager.subscribe,
    sessionManager.getSnapshot,
    sessionManager.getSnapshot,
  );
}

export function useIsAuthenticated(): boolean {
  return useSession() !== null;
}

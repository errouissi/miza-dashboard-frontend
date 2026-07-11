import { sessionManager } from "@/infrastructure/auth";

/**
 * The composition point where "the session ended" becomes "go to login".
 *
 * This is the ONLY place that knows both that a session exists and that a router
 * exists. Infrastructure announces the fact; the app layer decides what it means
 * (FTA §2). That separation is what keeps `infrastructure/auth` free of React and
 * react-router — and therefore unit-testable without either.
 *
 * `sessionManager.terminate()` is idempotent, so this handler fires exactly once
 * even when a page's five in-flight requests all 401 together (FTA §11).
 *
 * The redirect itself — preserving the return path, and only ever an in-app path,
 * never a caller-supplied one (an unvalidated return target is an open redirect) —
 * is wired to the router in M1-B, which is where a router first exists.
 */
export function wireSessionTermination(onSessionEnded: () => void): () => void {
  return sessionManager.onSessionEnded(onSessionEnded);
}

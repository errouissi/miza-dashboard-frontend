/**
 * The login redirect and its return path (FTA §11).
 *
 * "Preserve the return path, when safe" — and `when safe` is the load-bearing half
 * of that sentence. Only in-app paths are ever preserved. A caller-supplied target
 * is an open redirect waiting to be used, and it is not worth the convenience:
 * `/login?next=https://evil.example/harvest` would otherwise send an operator
 * straight from our login screen to someone else's.
 */

export const LOGIN_PATH = "/login";
export const RETURN_PARAM = "next";

/**
 * Accepts a path only if it is unambiguously internal:
 *   - starts with a single "/"                → rejects "https://…" and "//evil.com"
 *   - is not the login route itself           → prevents a redirect loop
 *
 * "//evil.com" is the one people miss: browsers read it as a protocol-relative
 * URL, so a naive `startsWith("/")` check lets an external host through.
 */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`)) return false;
  return true;
}

/** Builds `/login?next=<current>` — omitting `next` entirely when it isn't safe. */
export function buildLoginPath(returnTo?: string | null): string {
  if (!isSafeReturnPath(returnTo)) return LOGIN_PATH;
  return `${LOGIN_PATH}?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
}

/**
 * Reads a return path back out of a query string, re-validating it.
 *
 * Re-validation is not paranoia: the value arrives from the URL bar, which is
 * user-controlled. Whatever we wrote there, we do not trust what we read back.
 */
export function readReturnPath(search: string): string | null {
  const candidate = new URLSearchParams(search).get(RETURN_PARAM);
  return isSafeReturnPath(candidate) ? candidate : null;
}

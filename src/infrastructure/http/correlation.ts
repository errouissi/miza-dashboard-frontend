/**
 * Request correlation (FTA §11).
 *
 * BACKEND TICKET B-4 IS OPEN. The backend currently emits and logs no
 * request/correlation ID — there is no middleware for it. So today this is a
 * FRONTEND-ONLY trace: we generate an ID, send it, carry it on AppError, and can
 * show it to an operator as a support reference.
 *
 * What it is NOT, yet: a way to join a frontend error to a backend log line. That
 * requires the backend to log the header (B-4). We do not pretend otherwise, and
 * we do not invent a backend correlation contract (approved Decision 3).
 *
 * `readBackendRequestId` exists so that the day B-4 lands, the backend's ID takes
 * precedence over ours with no other change.
 */

export const REQUEST_ID_HEADER = "X-Request-Id";

export function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Non-crypto fallback. Correlation is a debugging aid, not a security control,
  // so uniqueness-in-practice is sufficient.
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type HeaderBag = { [key: string]: unknown } | undefined;

function readHeader(headers: HeaderBag, name: string): string | undefined {
  if (!headers) return undefined;

  // Header names are case-insensitive; axios normalizes inconsistently across adapters.
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return undefined;
}

/** The ID we sent on this request. */
export function readSentRequestId(headers: HeaderBag): string | undefined {
  return readHeader(headers, REQUEST_ID_HEADER);
}

/** The backend's ID, once B-4 lands. Undefined until then — by design. */
export function readBackendRequestId(headers: HeaderBag): string | undefined {
  return readHeader(headers, REQUEST_ID_HEADER);
}

/** Backend ID wins when present; ours is the fallback. */
export function resolveRequestId(
  responseHeaders: HeaderBag,
  requestHeaders: HeaderBag,
): string | undefined {
  return readBackendRequestId(responseHeaders) ?? readSentRequestId(requestHeaders);
}

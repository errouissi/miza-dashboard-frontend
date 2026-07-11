import { AppError, type AppErrorKind, type FieldErrors } from "./app-error";

/**
 * unknown -> AppError.
 *
 * DISCRIMINATION IS BY ENVELOPE, NOT BY HTTP STATUS (approved Decision 1).
 *
 * The backend emits two distinct 422 shapes, deliberately:
 *
 *   1. Laravel ValidationException   { message, errors: { field: [...] } }
 *   2. Domain rule violation         { success: false, code, message, context? }
 *
 * `BON_LINE_DUPLICATE_PRODUCT` and `BON_NUMBER_DUPLICATE` are domain errors
 * returned with status 422. A status-based normalizer would try to field-map
 * them, find no `errors` object, and render a form that silently does nothing.
 * So the envelope decides the kind; status only refines it.
 *
 * `context` is OMITTED when empty by explicit backend contract — never assume it.
 */

/** The backend's domain-error envelope (Phase-4A HTTP error envelope). */
type DomainEnvelope = {
  success: false;
  code: string;
  message?: string;
  context?: Record<string, unknown>;
};

/** Laravel's preserved ValidationException envelope. */
type ValidationEnvelope = {
  message?: string;
  errors: FieldErrors;
};

/** The one code the backend uses for every 403 source (AuthorizationExceptionRenderer). */
const AUTHORIZATION_DENIED = "AUTHORIZATION_DENIED";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasValidationEnvelope(body: unknown): body is ValidationEnvelope {
  return isRecord(body) && isRecord(body.errors);
}

function hasDomainEnvelope(body: unknown): body is DomainEnvelope {
  return isRecord(body) && typeof body.code === "string";
}

/** Status only refines a coded envelope; it never classifies one. */
function kindForCodedEnvelope(code: string, status: number | undefined): AppErrorKind {
  if (code === AUTHORIZATION_DENIED) return "permission";
  if (status === 404) return "notfound";
  return "domain";
}

/** Fallback for responses that carry no recognisable envelope (401, 500, HTML, …). */
function kindForBareStatus(status: number | undefined): AppErrorKind {
  if (status === undefined) return "unknown";
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "notfound";
  if (status >= 500) return "server";
  return "unknown";
}

export type NormalizeContext = {
  /** The X-Request-Id we sent, or the backend's echo of it once B-4 lands. */
  requestId?: string;
};

/** Shape of an axios-like failure, without importing axios (FTA §7). */
type HttpFailure = {
  response?: { status?: number; data?: unknown };
  message?: string;
};

function asHttpFailure(error: unknown): HttpFailure | undefined {
  return isRecord(error) ? (error as HttpFailure) : undefined;
}

export function normalizeError(error: unknown, ctx: NormalizeContext = {}): AppError {
  if (error instanceof AppError) return error;

  const failure = asHttpFailure(error);
  const response = failure?.response;

  // No response at all — the request never completed. Transport-level, retryable.
  if (!response) {
    return new AppError({
      kind: "network",
      message: failure?.message ?? "Network request failed.",
      requestId: ctx.requestId,
      cause: error,
    });
  }

  const status = response.status;
  const body = response.data;

  // 1. Envelope first: field-mapped validation.
  if (hasValidationEnvelope(body)) {
    return new AppError({
      kind: "validation",
      status,
      message: typeof body.message === "string" ? body.message : undefined,
      fieldErrors: body.errors,
      requestId: ctx.requestId,
      cause: error,
    });
  }

  // 2. Envelope second: a documented machine-readable code.
  if (hasDomainEnvelope(body)) {
    return new AppError({
      kind: kindForCodedEnvelope(body.code, status),
      status,
      code: body.code,
      message: typeof body.message === "string" ? body.message : undefined,
      // Read defensively: the key is absent whenever it would be empty.
      context: isRecord(body.context) ? body.context : undefined,
      requestId: ctx.requestId,
      cause: error,
    });
  }

  // 3. No envelope: classify by status. This is where 401 lands.
  const bareMessage =
    isRecord(body) && typeof body.message === "string" ? body.message : undefined;

  return new AppError({
    kind: kindForBareStatus(status),
    status,
    message: bareMessage ?? failure?.message,
    requestId: ctx.requestId,
    cause: error,
  });
}

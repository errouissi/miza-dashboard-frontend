/**
 * The single error type in the application (FTA §11).
 *
 * Every failure — a dropped socket, a 422, a domain 409, a 500 — arrives at
 * calling code as an AppError. Nothing outside this module inspects an axios
 * error, reads `error.response.status`, or string-matches a message. Callers
 * switch on `kind`.
 */

export type AppErrorKind =
  /** No response at all: offline, DNS, timeout, aborted. Safe to retry. */
  | "network"
  /** Laravel ValidationException — carries `fieldErrors`. */
  | "validation"
  /** A documented backend domain rule refused the action. Carries `code`. */
  | "domain"
  /** The caller is known but not permitted. */
  | "permission"
  /** The caller is not (or no longer) authenticated. Terminates the session. */
  | "auth"
  /** The record or route does not exist, or is scoped away from this caller. */
  | "notfound"
  /** The backend broke. Never rendered raw (FTA §17). */
  | "server"
  /** Normalization could not classify it. Treated as `server` by consumers. */
  | "unknown";

/** Field-mapped validation failures, exactly as Laravel emits them. */
export type FieldErrors = Record<string, string[]>;

export type AppErrorInit = {
  kind: AppErrorKind;
  /** HTTP status, when there was a response. */
  status?: number;
  /** The backend's machine-readable code, e.g. BON_NOT_DRAFT. */
  code?: string;
  /** The backend's message. NOT user-facing copy — see the error-code registry. */
  message?: string;
  fieldErrors?: FieldErrors;
  /**
   * The backend's `context` object. It is OMITTED ENTIRELY when empty, by
   * explicit backend contract — always read it defensively.
   */
  context?: Record<string, unknown>;
  /** Correlation reference for support (FTA §11). */
  requestId?: string;
  cause?: unknown;
};

export class AppError extends Error {
  readonly kind: AppErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly fieldErrors?: FieldErrors;
  readonly context?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(init: AppErrorInit) {
    super(init.message ?? init.kind, { cause: init.cause });
    this.name = "AppError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors;
    this.context = init.context;
    this.requestId = init.requestId;
  }

  /** Retry is safe only where the failure was transport-level (FTA §11). */
  get isRetryable(): boolean {
    return this.kind === "network" || this.kind === "server";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

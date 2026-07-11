import type { AppError } from "./app-error";

/**
 * The error-code registry (FTA D-10).
 *
 * The backend ships documented machine-readable codes (BON_NOT_DRAFT,
 * ALLOCATION_STOCK_INSUFFICIENT, COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN, …). This
 * is the one place each is turned into something an operator can act on: a
 * message, a tone, and — where one exists — a recovery path.
 *
 * ENTRIES ARE DELIBERATELY EMPTY IN PR-1.
 * Their content is user-facing copy, and the interface-language decision (O-1)
 * is unsigned. Writing ~40 French messages now is exactly the rework M0 flagged.
 * Entries are added per resource (resource recipe, step 7) once O-1 lands.
 *
 * The mechanism, the fallback, and their tests ship now — so an unregistered
 * code degrades to "unhelpful but safe" rather than to a blank screen.
 */

/** Semantic tones from the Design System (§17). */
export type ErrorTone = "danger" | "warning" | "info";

export type RecoveryPath = {
  /** Copy for the action. Owned by the copy layer — see O-1. */
  label: string;
  /** In-app route to the flow that resolves the condition. */
  to: string;
};

export type ErrorCodeEntry = {
  message: string;
  tone: ErrorTone;
  recovery?: RecoveryPath;
};

/**
 * code -> presentation. Populated per domain as codes are documented (B-3).
 * Names MUST match the backend's codes exactly; they are the contract.
 */
export const ERROR_CODES: Readonly<Record<string, ErrorCodeEntry>> = Object.freeze({});

/** Unregistered codes are still failures, and a failure is never "info". */
const FALLBACK_TONE: ErrorTone = "danger";

export type ErrorDisplay = {
  /**
   * Registered copy, or `undefined` when the code is unknown. The UI renders a
   * generic message in that case — copy belongs to the copy layer, not here.
   */
  message: string | undefined;
  tone: ErrorTone;
  recovery?: RecoveryPath;
  /**
   * Always surfaced. An unregistered code must still be quotable to support,
   * which is what keeps an unknown failure diagnosable instead of opaque.
   */
  code?: string;
  /** Correlation reference (FTA §11). */
  requestId?: string;
};

export function lookupErrorCode(code: string | undefined): ErrorCodeEntry | undefined {
  return code ? ERROR_CODES[code] : undefined;
}

/** Everything the UI needs to render a failure, derived from one AppError. */
export function resolveErrorDisplay(error: AppError): ErrorDisplay {
  const entry = lookupErrorCode(error.code);

  return {
    message: entry?.message,
    tone: entry?.tone ?? FALLBACK_TONE,
    recovery: entry?.recovery,
    code: error.code,
    requestId: error.requestId,
  };
}

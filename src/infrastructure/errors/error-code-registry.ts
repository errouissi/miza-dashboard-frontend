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
 *
 * AGENT STOCK RETURNS (roadmap M5, Phase 1) — the FIRST REAL POPULATION of
 * this registry. Every prior domain (Cheques, Deposits, Debt Payments) hand-
 * rolled its own dialog-level `errorMessage` by checking `AppError.kind`/
 * `fieldErrors` directly, because none of their own failures carry a
 * documented machine-readable `code` (`normalizeError` classifies them
 * `kind: "validation"` or a bare-status fallback, never `"domain"`). Agent
 * Stock Return's 13 codes, verified fresh from source
 * (`AgentStockReturnExceptionRenderer`), are this app's first
 * `{success:false, code, message, context?}` envelope a screen actually
 * needs to render — exactly the case D-10 and this file's own scaffolding
 * were built for. English copy throughout (confirmed decision — O-1 is
 * still formally unsigned, but every domain shipped English so far).
 *
 * NO `recovery` PATHS YET — Stock's own cross-flow links (e.g. a stock-
 * insufficient refusal pointing at "record a sale" or "request a transfer")
 * are not this phase's job, and inventing one would be UI the operator
 * cannot act on from here. `RETURN_RECIPIENT_*` codes are LIFECYCLE
 * DRIFT DETECTION (the binding was valid at draft creation, re-asserted
 * under lock at validate time) — not currently reachable through this
 * phase's own UI, which enforces the same binding at creation, but
 * registered anyway per D-10 ("every documented backend code has an entry").
 */
export const ERROR_CODES: Readonly<Record<string, ErrorCodeEntry>> = Object.freeze({
  RETURN_NOT_DRAFT: {
    message: "This stock return has already been processed.",
    tone: "warning",
  },
  RETURN_HAS_NO_LINES: {
    message: "Add at least one line before validating this stock return.",
    tone: "warning",
  },
  RETURN_NOT_EDITABLE: {
    message: "This stock return can no longer be edited.",
    tone: "warning",
  },
  RETURN_STOCK_INSUFFICIENT: {
    message:
      "The commercial does not hold enough stock of this product to return the requested quantity.",
    tone: "danger",
  },
  RETURN_RECIPIENT_BINDING_MISMATCH: {
    message: "This commercial no longer belongs to the selected manager.",
    tone: "danger",
  },
  RETURN_MANAGER_ROLE_INVALID: {
    message: "The selected recipient is not a manager.",
    tone: "danger",
  },
  RETURN_COMMERCIAL_ROLE_INVALID: {
    message: "The selected agent is not a commercial.",
    tone: "danger",
  },
  RETURN_MANAGER_INACTIVE: {
    message: "The selected manager is no longer active.",
    tone: "danger",
  },
  RETURN_COMMERCIAL_INACTIVE: {
    message: "The selected commercial is no longer active.",
    tone: "danger",
  },
  RETURN_LINE_DUPLICATE_PRODUCT: {
    message:
      "This product is already on this stock return. Edit the existing line instead of adding a new one.",
    tone: "warning",
  },
  RETURN_NUMBER_DUPLICATE: {
    message: "This return number is already in use.",
    tone: "warning",
  },
  RETURN_NOT_FOUND: {
    message: "This stock return could not be found.",
    tone: "danger",
  },
  RETURN_LINE_NOT_FOUND: {
    message: "This line could not be found.",
    tone: "danger",
  },

  /**
   * AGENT TRANSFERS (roadmap M5, Phase 2) — 15 codes, verified fresh from
   * source (`AgentTransferExceptionRenderer`). Registered EXPLICITLY, one
   * by one, NOT derived by a mechanical `RETURN_` -> `TRANSFER_` rename:
   * the two resources' code vocabularies were seeded independently and
   * genuinely diverge — `TRANSFER_RECIPIENT_MANAGER_ROLE_INVALID` carries
   * a `RECIPIENT_` infix its Return equivalent (`RETURN_MANAGER_ROLE_
   * INVALID`) does not have. A find-replace would have silently produced
   * five wrong strings.
   *
   * TWO CODES HAVE NO RETURN EQUIVALENT AT ALL:
   *   `AGENT_TRANSFER_EXCEEDS_CAPACITY` — a REAL, LIVE capacity gate
   *     (`StockService::validateTransfer`'s own formula: available =
   *     montant_avance_grattage − (validated transfers in − validated
   *     returns out)), unlike Return's floor-only stock check. Note the
   *     PREFIX ITSELF diverges (`AGENT_TRANSFER_`, not `TRANSFER_`) —
   *     copied verbatim from source, not normalized.
   *   `TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION` — this IS the
   *     Grattage restock gate (Operational Restrictions, Phase 5.10 §2.9),
   *     surfacing here REACTIVELY because `StockService::validateTransfer`
   *     already enforces it server-side. The PROACTIVE version (a shared
   *     hook Stock's own forms consult before submitting) is an explicit
   *     M6 Grattage deliverable per the frozen roadmap, not built here —
   *     no `recovery` path is registered for it yet for the same reason
   *     `RETURN_RECIPIENT_*`'s own codes have none: the flow it would link
   *     to (Grattage) does not exist as a frontend route yet.
   */
  TRANSFER_NOT_DRAFT: {
    message: "This transfer has already been processed.",
    tone: "warning",
  },
  TRANSFER_HAS_NO_LINES: {
    message: "Add at least one line before validating this transfer.",
    tone: "warning",
  },
  TRANSFER_NOT_EDITABLE: {
    message: "This transfer can no longer be edited.",
    tone: "warning",
  },
  AGENT_TRANSFER_EXCEEDS_CAPACITY: {
    message:
      "This transfer's amount exceeds the commercial's remaining grattage capacity.",
    tone: "danger",
  },
  TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION: {
    message:
      "The selected commercial has an outstanding grattage obligation and cannot receive new stock yet.",
    tone: "danger",
  },
  TRANSFER_STOCK_INSUFFICIENT: {
    message:
      "The manager does not hold enough stock of this product to transfer the requested quantity.",
    tone: "danger",
  },
  TRANSFER_RECIPIENT_BINDING_MISMATCH: {
    message: "This commercial no longer belongs to the selected manager.",
    tone: "danger",
  },
  TRANSFER_RECIPIENT_MANAGER_ROLE_INVALID: {
    message: "The selected recipient is not a manager.",
    tone: "danger",
  },
  TRANSFER_RECIPIENT_COMMERCIAL_ROLE_INVALID: {
    message: "The selected agent is not a commercial.",
    tone: "danger",
  },
  TRANSFER_RECIPIENT_MANAGER_INACTIVE: {
    message: "The selected manager is no longer active.",
    tone: "danger",
  },
  TRANSFER_RECIPIENT_COMMERCIAL_INACTIVE: {
    message: "The selected commercial is no longer active.",
    tone: "danger",
  },
  TRANSFER_LINE_DUPLICATE_PRODUCT: {
    message:
      "This product is already on this transfer. Edit the existing line instead of adding a new one.",
    tone: "warning",
  },
  TRANSFER_NUMBER_DUPLICATE: {
    message: "This transfer number is already in use.",
    tone: "warning",
  },
  TRANSFER_NOT_FOUND: {
    message: "This transfer could not be found.",
    tone: "danger",
  },
  TRANSFER_LINE_NOT_FOUND: {
    message: "This line could not be found.",
    tone: "danger",
  },
});

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

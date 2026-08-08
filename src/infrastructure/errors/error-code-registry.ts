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
   *     registered here as the REACTIVE fallback `StockService
   *     ::validateTransfer` still enforces server-side regardless. UPDATED
   *     M6 PHASE 3 — a PROACTIVE version now also exists:
   *     `AgentTransferDetailPage` reads `useGrattageRestockGateQuery
   *     (agentTransfer.commercialId)` (Grattage's ONE sanctioned public
   *     surface) and disables Validate directly; this entry's own
   *     `message` is reused verbatim by that proactive banner via
   *     `lookupErrorCode`, so the two expressions of the same fact can
   *     never drift apart. Still no `recovery` path — a link into Grattage
   *     itself is a separate, later decision, not implied by this pairing.
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

  /**
   * ALLOCATIONS (roadmap M5, Phase 4) — 9 codes, verified fresh from
   * source (`AllocationExceptionRenderer`). FEWER THAN RETURN'S 13 OR
   * TRANSFER'S 15 — a genuine divergence, not an incomplete registration:
   * Allocation's binding pair (`company_id` + `agent_id` role=manager) is
   * validated by plain FormRequest `exists()` rules, so it has NO
   * role-mismatch/inactive/binding-drift exception family the way Return's
   * `RETURN_MANAGER_ROLE_INVALID`/`RETURN_COMMERCIAL_INACTIVE`/
   * `RETURN_RECIPIENT_BINDING_MISMATCH` (and Transfer's own equivalents) do.
   *
   * THE SOLE ALLOCATION-ONLY GATE: `ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY` —
   * the manager's available grattage-deposit capacity is less than the
   * allocation's own `montant`. REACTIVE ONLY — no proactive capacity read
   * exists (BC-AA stays partially open), same restraint Transfer's own
   * `AGENT_TRANSFER_EXCEEDS_CAPACITY` still has.
   *
   * `ALLOCATION_TEAM_HAS_OUTSTANDING_OBLIGATION` NO LONGER EXISTS — backend
   * commit `9af5d00` REMOVED the team-wide hard block this code used to
   * mean (`AllocationTeamHasOutstandingObligation` was deleted outright;
   * the renderer can never emit this code again). It briefly gained a
   * PROACTIVE consumer at M6 Phase 3 (`AllocationDetailPage` reading
   * `useGrattageRestockGateQuery`) — both the entry and that consumer were
   * removed together once the backend contract changed. The eligible
   * validated-grattage-deposit pool behind `ALLOCATION_EXCEEDS_DEPOSIT_
   * CAPACITY`'s own formula was widened instead (manager + team
   * commercials) — an outstanding commercial obligation now restores zero
   * capacity but is never, by itself, a refusal. Do NOT re-add this code
   * or re-derive its old meaning client-side. Transfer's own equivalent
   * gate (`TRANSFER_RECIPIENT_HAS_OUTSTANDING_OBLIGATION`) is UNCHANGED
   * and still real — see that entry below.
   */
  ALLOCATION_NOT_DRAFT: {
    message: "This allocation has already been processed.",
    tone: "warning",
  },
  ALLOCATION_HAS_NO_LINES: {
    message: "Add at least one line before validating this allocation.",
    tone: "warning",
  },
  ALLOCATION_NOT_EDITABLE: {
    message: "This allocation can no longer be edited.",
    tone: "warning",
  },
  ALLOCATION_EXCEEDS_DEPOSIT_CAPACITY: {
    message:
      "The manager does not have enough validated grattage-deposit capacity to cover this allocation's amount.",
    tone: "danger",
  },
  ALLOCATION_STOCK_INSUFFICIENT: {
    message:
      "The company does not hold enough stock of this product to cover the requested quantity.",
    tone: "danger",
  },
  ALLOCATION_LINE_DUPLICATE_PRODUCT: {
    message:
      "This product is already on this allocation. Edit the existing line instead of adding a new one.",
    tone: "warning",
  },
  ALLOCATION_NUMBER_DUPLICATE: {
    message: "This allocation number is already in use.",
    tone: "warning",
  },
  ALLOCATION_NOT_FOUND: {
    message: "This allocation could not be found.",
    tone: "danger",
  },
  ALLOCATION_LINE_NOT_FOUND: {
    message: "This line could not be found.",
    tone: "danger",
  },

  /**
   * BONS (roadmap M5, Phase 5 — the fifth and final Stock resource) — 9
   * codes, verified fresh from source (`BonExceptionRenderer`). NO
   * `BON_STOCK_INSUFFICIENT` EXISTS — `validateBon()` has no capacity or
   * stock-sufficiency check at all (a bon is the SOURCE of stock, not a
   * consumer). The only stock-insufficiency code in this whole resource
   * is `BON_CANCEL_STOCK_INSUFFICIENT`, reachable only via cancel — a
   * REAL, LIVE 409: the stock a bon brought in may already have been
   * drawn down elsewhere (e.g. a later Allocation) by the time
   * cancellation is attempted.
   *
   * `BON_NOT_CANCELLABLE`/`BON_CANCEL_STOCK_INSUFFICIENT` have NO
   * equivalent in Allocation/Transfer/Return — Bons is the only Stock
   * resource with a real cancel lifecycle (BC-AB).
   */
  BON_NOT_DRAFT: {
    message: "This bon has already been processed.",
    tone: "warning",
  },
  BON_HAS_NO_LINES: {
    message: "Add at least one line before validating this bon.",
    tone: "warning",
  },
  BON_NOT_EDITABLE: {
    message: "This bon can no longer be edited.",
    tone: "warning",
  },
  BON_NOT_CANCELLABLE: {
    message: "This bon is not in a state that can be cancelled.",
    tone: "warning",
  },
  BON_CANCEL_STOCK_INSUFFICIENT: {
    message:
      "This bon cannot be cancelled: the stock it brought in has already been used elsewhere.",
    tone: "danger",
  },
  BON_LINE_DUPLICATE_PRODUCT: {
    message:
      "This product is already on this bon. Edit the existing line instead of adding a new one.",
    tone: "warning",
  },
  BON_NUMBER_DUPLICATE: {
    message: "This bon number is already in use.",
    tone: "warning",
  },
  BON_NOT_FOUND: {
    message: "This bon could not be found.",
    tone: "danger",
  },
  BON_LINE_NOT_FOUND: {
    message: "This line could not be found.",
    tone: "danger",
  },

  /**
   * Agents (roadmap M7, Agent 360 completion item) — the Zero-stock
   * reassignment guard's own reactive fallback. `AgentController::update()`
   * returns this atomically, under lock, when a commercial's manager_id
   * reassignment is attempted while their held stock is nonzero — the
   * proactive `stock-quantity` read `AgentEditDrawer` shows inline is only
   * a UX hint; this is the authoritative refusal, reachable even when that
   * proactive read said zero moments earlier (a genuine race).
   */
  COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN: {
    message:
      "This commercial still holds stock and cannot be reassigned to another manager until it is returned or cleared.",
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

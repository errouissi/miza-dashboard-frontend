import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * A cheque — the first Money resource (roadmap M4.2), and the product's
 * first resource outside Network.
 *
 * CONTRACT VERIFIED INDEPENDENTLY FROM SOURCE (`ChequeController`, the
 * `Cheque`/`ChequeAllocation` models, the `cheques`/`cheque_allocations`
 * migrations), per the M4 discovery pass and re-confirmed at the start of
 * this phase — not assumed from the roadmap's or the discovery report's
 * own prose summary.
 *
 * `amount` (here and on `ChequeAllocation`) IS A STRING, which CORRECTS an
 * assumption made in the M4.1 discovery/write-up. `cheques.amount` and
 * `cheque_allocations.amount` are both `decimal:2`-CAST columns, and
 * Eloquent's decimal cast always serializes as a formatted STRING
 * (`"1500.00"`), never a JSON number — confirmed from Laravel's own
 * `asDecimal()` cast implementation (`(string) number_format(...)`), not
 * assumed from the column type alone. M4.1's shared `MoneyAmount` component
 * takes a `number` and was justified partly by an expectation that Money's
 * amount fields would be genuinely numeric; they are not, and must NOT be
 * parsed into one — the SAME discipline `Manager.avanceTotal` and
 * `Client.solde` already established (a decimal-cast/computed string must
 * never round-trip through binary floating point). Render `amount` verbatim
 * wherever it appears; do not wrap it in `<MoneyAmount>` without first
 * deciding, deliberately, that a parse is safe for that specific case.
 *
 * `status`/label: the backend computes its OWN `status_label` accessor, but
 * it is deliberately NOT modelled here (ADR-0008) — verified buggy from
 * source: `Cheque::getStatusLabelAttribute()`'s `rejetee` branch returns the
 * raw status constant string `'rejetee'` itself, not a real label, and every
 * other branch is French-only regardless (O-1 is unsigned).
 * `CHEQUE_STATUS_LABELS` below is a fresh, English, domain-owned map,
 * following the exact precedent every Network status enum already
 * established — not a translation of the backend's.
 *
 * NOT MODELLED: who approved/rejected/annulled a cheque. `index()` computes
 * a clean flat `processed_by_name` (from a correctly-typed `processedByUser`
 * `belongsTo(User::class, 'processed_by')` relation) — but `show()` instead
 * eager-loads a DIFFERENT relation, `processedBy()`
 * (`belongsTo(Agent::class, 'processed_by')`), despite `processed_by`
 * actually storing a **User** id (`$request->user()->id`, set in
 * `approve()`/`reject()`/`annuler()`). Because Eloquent's array
 * serialization merges relations over same-named raw attributes, `show()`'s
 * response OVERWRITES the raw `processed_by` FK integer with this
 * mismatched relation's (likely null or wrong) result — a real,
 * verified-from-source inconsistency between the two endpoints, not
 * something a frontend mapper can paper over. Left unmapped until raised
 * with the backend.
 */

export const CHEQUE_STATUSES = ["en_attente", "accepter", "rejetee", "annuler"] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

/** Domain-owned labels. Temporary English pending O-1. */
export const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  en_attente: "Pending",
  accepter: "Approved",
  rejetee: "Rejected",
  annuler: "Cancelled",
};

/**
 * Domain-owned tone mapping (Design System §17) for the shared `StatusBadge`
 * — mirrors §17's own worked example exactly: Cheques' `en_attente` is
 * named there as the canonical `warning` case, `accepter` as `success`,
 * `rejetee` as `danger`, `annuler` as `muted`.
 */
export const CHEQUE_STATUS_TONES: Record<ChequeStatus, StatusTone> = {
  en_attente: "warning",
  accepter: "success",
  rejetee: "danger",
  annuler: "muted",
};

/**
 * `cheque_allocations.type` — an approved cheque's amount split between
 * `rapped` (cash-like, flows into `agent.solde`) and `grattage` (stock
 * allocation capacity only, never `solde`). See `ChequeController::approve`.
 */
export const CHEQUE_ALLOCATION_TYPES = ["rapped", "grattage"] as const;
export type ChequeAllocationType = (typeof CHEQUE_ALLOCATION_TYPES)[number];

export type ChequeAllocation = {
  id: number;
  type: ChequeAllocationType;
  /** decimal(10,2) — a STRING. See the module docblock. */
  amount: string;
};

export type Cheque = {
  id: number;
  /** decimal(10,2) — a STRING. See the module docblock. */
  amount: string;
  numCheque: string;
  status: ChequeStatus;
  agentId: number;
  /**
   * `"{prenom} {nom}"`, reduced from the nested `agent` relation at the
   * mapper boundary — the same reduction Commercials/Clients already apply
   * to their own nested manager/agent relation (ADR-0012: no shared/merged
   * mapper across domains, but the PATTERN of reducing a relation to a
   * display string at the boundary is consistent).
   */
  agentName: string;
  /** Absolute URL, or null if a photo somehow was not stored. */
  photoUrl: string | null;
  /** The reason given on reject/annuler; null while pending or approved. */
  decisionReason: string | null;
  /** ISO datetime; null while pending. */
  processedAt: string | null;
  /** ISO datetime — this IS the submission date for a cheque; no separate field exists. */
  createdAt: string;
  /**
   * Only present on a single-record read: `show()` eager-loads
   * `allocations`; `index()`/`pending()` do not. `undefined` on a list row
   * — never an empty array standing in for "not fetched".
   */
  allocations?: ChequeAllocation[];
};

/**
 * The list query surface, mirroring `ChequeController::index`'s validator
 * exactly: `statute` (nullable enum, `all` treated identically to omitting
 * it), `agent_id`, `date_from`/`date_to`, `search` (num_cheque only,
 * case-sensitive `LIKE` — unverified either way this phase, no UI to
 * exercise it), `per_page` (max 100).
 *
 * `""` means "unfiltered" and is omitted from the request entirely, the
 * same convention every prior resource's `ListParams` type already uses —
 * keeping the frontend's "cleared" and "never set" in agreement.
 */
export type ChequeListParams = {
  page: number;
  perPage: number;
  search: string;
  /** "" = every status. */
  status: ChequeStatus | "";
  /** "" = every agent. A string (not a number) because it is a filter value, matching `CommercialListParams.managerId`'s own convention. */
  agentId: string;
  /** `Y-M-D`. Compared against `created_at >=`. */
  dateFrom: string;
  /** `Y-M-D`. Compared against `created_at <=`. */
  dateTo: string;
};

/** Backend default: `paginate($request->per_page ?? 15)`. */
export const CHEQUE_LIST_DEFAULTS: ChequeListParams = {
  page: 1,
  perPage: 15,
  search: "",
  status: "",
  agentId: "",
  dateFrom: "",
  dateTo: "",
};

/** `per_page` is capped server-side (`integer|min:1|max:100`). */
export const MAX_PER_PAGE = 100;

/**
 * The pending-queue query surface (M4.2 Phase 3B), mirroring
 * `ChequeController::pending` exactly: NO filters at all — verified from
 * source, unlike `index()`'s validator, `pending()` runs no
 * `$request->validate()` and applies no `statute`/`agent_id`/`date_from`/
 * `date_to`/`search` — it is unconditionally `Cheque::pending()`, oldest
 * first. Only pagination applies, so this type stays deliberately narrower
 * than `ChequeListParams` rather than reusing it with unused fields (FTA
 * working principle: expose only what the API supports).
 */
export type PendingChequeListParams = {
  page: number;
  perPage: number;
};

/** Backend default: `paginate($request->per_page ?? 15)`, same as `index()`. */
export const PENDING_CHEQUE_LIST_DEFAULTS: PendingChequeListParams = {
  page: 1,
  perPage: 15,
};

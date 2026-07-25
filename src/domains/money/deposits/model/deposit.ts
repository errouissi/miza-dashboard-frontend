import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * A deposit — the second Money resource (roadmap M4.3).
 *
 * CONTRACT VERIFIED FRESH FROM SOURCE this phase (`DepoController`,
 * `DepoResource`, the `Deposit` model, the `deposits` migration), not
 * carried forward from the M4.3 discovery pass unchecked — the backend
 * changed underneath that pass (commit `8786326`, which unified `index()`/
 * `show()`/`store()` onto one `DepoResource` shape and added
 * `reject_reason`/`validated_by`/`validated_at`/`bank_name`/`proof_type`).
 *
 * `amount` IS A REAL NUMBER, unlike `Cheque.amount` — `DepoResource`
 * explicitly casts it (`(float) $this->amount`), not a `decimal:2` string
 * left to serialize as-is. This is the first genuine caller `MoneyAmount`'s
 * own docblock already named ahead of time ("Money's Cheque/Deposit/Debt
 * Payment `amount` fields once that domain is built") — Cheque turned out
 * to be a string; Deposit is the real one.
 *
 * `date` (`Y-m-d H:i`, e.g. `"2026-07-25 14:30"`) is NOT the ISO-8601 shape
 * Cheques' `created_at`/`processed_at` are — see `api/deposits-api.ts`'s
 * own docblock for why the mapper normalizes it before it ever reaches
 * `shared/formatters`.
 *
 * `rejectReason`/`validatedByName`/`validatedAt`/`bankName`/`proofType`
 * (M4.3 Phase 2) — added now that the detail page reads them; Phase 1
 * deliberately left them off this type until it had a real caller.
 *
 * `validatedByName`/`validatedAt` ARE NOT EXCLUSIVE TO A VALIDATED
 * DEPOSIT — re-verified from source (`DepositService::reject()`, not just
 * `validate()`): rejecting a deposit ALSO sets `validated_by_admin`/
 * `validated_at` (the backend's own field names are simply misleading for
 * that case — they mean "who/when processed this", not literally
 * "validated"). Both populate for a validated OR a rejected deposit; both
 * stay `null` only while `pending`.
 */

export const DEPOSIT_STATUSES = ["pending", "validated", "rejected"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

/** Domain-owned labels (English, matching Cheques' own O-1-pending convention). */
export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  pending: "Pending",
  validated: "Validated",
  rejected: "Rejected",
};

/**
 * Domain-owned tone mapping (Design System §17) — `pending` as the
 * canonical `warning` case, `validated` as `success`, `rejected` as
 * `danger`, mirroring Cheques' own worked mapping for the equivalent
 * three states (Cheques additionally has `annuler`, which Deposits has no
 * equivalent of: there is no reversal of a validated deposit).
 */
export const DEPOSIT_STATUS_TONES: Record<DepositStatus, StatusTone> = {
  pending: "warning",
  validated: "success",
  rejected: "danger",
};

export const DEPOSIT_TYPES = ["rapped", "grattage"] as const;
export type DepositType = (typeof DEPOSIT_TYPES)[number];

/**
 * Domain-owned labels for `type` — rendered as PLAIN TEXT, never through
 * `StatusBadge`. `type` does not transition (set once at creation, never
 * changed by any endpoint — verified from source) and carries no
 * lifecycle-color meaning the way `status` does; `StatusBadge` is for
 * status, not an arbitrary categorical field.
 */
export const DEPOSIT_TYPE_LABELS: Record<DepositType, string> = {
  rapped: "Rapped",
  grattage: "Grattage",
};

/**
 * `method` — a genuine, backend-enforced enum, verified from BOTH the
 * `deposits` migration (`$table->enum('method', ['bank', 'cash',
 * 'other'])`) and `store()`'s validator (`required|in:bank,cash,other`).
 * A DB `enum` column cannot physically hold any other value, so narrowing
 * to a literal union here is justified — not the premature narrowing this
 * project's own working principles warn against when a backend enum is
 * unverified or open-ended.
 */
export const DEPOSIT_METHODS = ["bank", "cash", "other"] as const;
export type DepositMethod = (typeof DEPOSIT_METHODS)[number];

export const DEPOSIT_METHOD_LABELS: Record<DepositMethod, string> = {
  bank: "Bank",
  cash: "Cash",
  other: "Other",
};

export type Deposit = {
  id: number;
  /** A real number — see the module docblock. Safe for `<MoneyAmount>`. */
  amount: number;
  status: DepositStatus;
  type: DepositType;
  method: DepositMethod;
  /** `receipt_number`, nullable. */
  receipt: string | null;
  proofUrl: string | null;
  /**
   * ISO-8601-normalized at the mapper boundary (the wire value is
   * `Y-m-d H:i`, not ISO) — safe to pass straight into `formatDate`/
   * `formatDateTime`. See `api/deposits-api.ts`.
   */
  createdAt: string;
  agentId: number;
  agentName: string;
  agentAccountNumber: string;
  agentPhotoUrl: string | null;
  /** `"System"` fallback is baked in server-side when no admin created it. */
  createdBy: string;
  /** Only ever set by `reject()`. `null` while pending or validated. */
  rejectReason: string | null;
  /** See the module docblock — populates for validated OR rejected, not "validated" exclusively. */
  validatedByName: string | null;
  /**
   * ISO-8601-normalized at the mapper boundary, same as `createdAt` (the
   * wire value is the identical non-ISO `Y-m-d H:i` shape). See the module
   * docblock for why `null` does not mean "not yet validated" specifically.
   */
  validatedAt: string | null;
  /** Optional at creation. */
  bankName: string | null;
  /**
   * Defaults to `"bank_receipt"` server-side when omitted at creation, and
   * the DB column is non-nullable — realistically always a real value, but
   * kept as the plain string the wire sends rather than narrowed to a
   * union (unlike `method`, this field's exact vocabulary was not
   * independently re-verified as closed this phase).
   */
  proofType: string;
};

/**
 * The list query surface, mirroring `DepoController::index`'s validator
 * exactly (verified from source — no `$request->validate()` call exists in
 * `index()`; every filter below is simply `$request->filled(...)`):
 *   `search` (prefix match on `receipt_number` OR the agent's account
 *   number), `agent_id`, `deposit_method` (the WIRE name — the column is
 *   `method`, but the request key stays the legacy `deposit_method`),
 *   `type`, `status`.
 *
 * DELIBERATELY NO `perPage` FIELD — `index()` calls `$query->paginate(20)`
 * with the page size HARDCODED; `$request->per_page` is never read at all
 * (confirmed from source, unlike Cheques' own `paginate($request->per_page
 * ?? 15)`). There is nothing for a per-page control to send, so this type
 * does not carry one — exposing a control the API ignores would misrepresent
 * the system, the same principle that keeps `PendingChequeListParams`
 * filter-free.
 *
 * NO date-range filter, NO sort parameter — neither exists server-side.
 */
export type DepositListParams = {
  page: number;
  search: string;
  /** "" = every agent. A string, matching `ChequeListParams.agentId`'s own convention. */
  agentId: string;
  /** "" = every method. */
  method: DepositMethod | "";
  /** "" = every type. */
  type: DepositType | "";
  /** "" = every status. */
  status: DepositStatus | "";
};

export const DEPOSIT_LIST_DEFAULTS: DepositListParams = {
  page: 1,
  search: "",
  agentId: "",
  method: "",
  type: "",
  status: "",
};

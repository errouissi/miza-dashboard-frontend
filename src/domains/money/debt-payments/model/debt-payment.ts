/**
 * A debt payment — the third and final Money resource (roadmap M4).
 *
 * CONTRACT VERIFIED FRESH FROM SOURCE this phase (`DebtPaymentController`,
 * the `DebtPayment` model, its migration, `routes/api.php`):
 *
 * `admin_id` -> `User`, NOT `Agent` — the one genuine structural difference
 * from Cheques/Deposits. This resource is not about an agent's balance; it
 * is about the LOGGED-IN ADMIN's own debt to the company (accrued, among
 * other ways, by Deposits' own rapped+cash-method side effect — see
 * `DepoController::store`, which adds to `currentAdmin->debt`). `index()`
 * hard-scopes every query to `Auth::user()`; there is no `admin_id` filter
 * anywhere, so this is inherently a self-service screen, never a
 * cross-admin management list.
 *
 * `amount` IS A `decimal:2`-cast STRING, same discipline as `Cheque.amount`
 * (never parsed to a number, rendered verbatim wherever it appears) — NOT
 * a real number the way `Deposit.amount` is.
 *
 * `created_at` IS PLAIN LARAVEL ISO-8601 — verified no Carbon serialization
 * override exists anywhere in the backend (no `AppServiceProvider`
 * override, no custom `JsonResource`; `DebtPayment` has no dedicated
 * Resource at all, just a raw `toArray()`). This is the SAME shape Cheques'
 * `created_at`/`processed_at` already use, NOT Deposits' non-ISO
 * `Y-m-d H:i` — no `toIsoDateTime()`-style mapper-boundary normalization
 * is needed here.
 *
 * NO `status`, NO `type` column exists on this model at all — there is no
 * lifecycle here (no pending/approved/rejected), so no `StatusBadge`
 * anywhere on this screen. `show()`/`destroy()` are both commented out in
 * `routes/api.php` — dead routes, confirmed from source — so there is no
 * detail page and no delete UI to build; this is `list + submit` only, the
 * simplest Money resource by a wide margin.
 */

export type DebtPayment = {
  id: number;
  /** A `decimal:2`-cast STRING — render verbatim, never parse. See the module docblock. */
  amount: string;
  /** `receipt_number`, nullable at the column level but `required` by `store()`'s own validator. */
  receipt: string | null;
  proofUrl: string | null;
  /** Plain ISO-8601 — see the module docblock. Safe for `formatDate`/`formatDateTime` directly. */
  createdAt: string;
};

/**
 * The two summary scalars `index()` returns ALONGSIDE the paginated list —
 * verified from source (`DebtPaymentController::index`):
 *   `current_debt` = `$admin->debt` (the SAME `decimal:2`-cast string the
 *     create form's own ceiling check reads).
 *   `total_paid`   = `DebtPayment::where('admin_id', $admin->id)->sum('amount')`
 *     — a plain SQL `SUM` over a query-builder aggregate, NOT a cast model
 *     attribute. Whether the PDO driver hands this back as a JSON number or
 *     a numeric string is genuinely ambiguous from source alone (no live
 *     response was captured this phase) — the mapper (`api/debt-payments-
 *     api.ts`) coerces it with `String(...)` defensively at the boundary
 *     regardless of which the wire actually sends, so this type is correct
 *     either way. Both fields render verbatim, never parsed for arithmetic,
 *     the same discipline `amount` above already follows.
 *
 * No prior Money resource's list endpoint returns anything beyond the
 * paginated rows themselves — this is the first list response this app
 * parses that carries extra scalar context alongside the page.
 */
export type DebtPaymentsSummary = {
  currentDebt: string;
  totalPaid: string;
};

/**
 * The list query surface — `index()` accepts NO filters, NO sort, NO
 * per-page parameter (verified from source: no `$request->validate()` call
 * exists at all, and `paginate(20)` hardcodes the page size, unlike
 * Cheques' own `paginate($request->per_page ?? 15)`). `page` is the only
 * parameter this type or the API layer ever sends — the same
 * filter-free shape `DepositListParams`'/`PendingChequeListParams`' own
 * docblocks already established for an endpoint with nothing to filter by.
 */
export type DebtPaymentListParams = {
  page: number;
};

export const DEBT_PAYMENT_LIST_DEFAULTS: DebtPaymentListParams = {
  page: 1,
};

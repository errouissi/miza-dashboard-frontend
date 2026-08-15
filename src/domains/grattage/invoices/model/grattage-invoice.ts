import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * A Grattage Invoice — the first Grattage resource (roadmap M6, Phase 1).
 * The commercial's retail cash-sale obligation to the company (NOT a
 * client receivable — a client owes nothing under grattage; see
 * `SalesService`'s own docblock, backend).
 *
 * ADMIN SCOPE IS READ + CANCEL ONLY, VERIFIED FROM SOURCE
 * (`GrattageInvoiceController`, `routes/api.php:378-400`): `store()` and
 * `settle()` both hard-403 by deliberate backend design (Phase 5.8b /
 * 5.10) — creation is commercial-only, settlement happens exclusively via
 * a validated `type=grattage` reconciliation Deposit
 * (`DepositService::validate()`). Neither is built here, and no workaround
 * is attempted (M6 discovery report, confirmed against both frozen
 * `phase8-architecture.html` §5 and `phase8-frontend-implementation-
 * roadmap.html` §M6).
 *
 * `totalAmount` IS A `decimal:2`-CAST STRING, NOT A NUMBER — same
 * discipline as `Cheque.amount`/`Bon.montant` (verified from source:
 * `GrattageInvoice::$casts`, no Resource layer at all — `Grattage
 * InvoiceController` returns the raw Eloquent model). Carried and
 * rendered verbatim, never parsed through `<MoneyAmount>` (see
 * `cheques-list-page.tsx`'s own docblock for the established reasoning).
 *
 * STATUS LIFECYCLE (verified from `GrattageInvoice`/`GrattageInvoiceService`,
 * backend): `pending -> overdue` (automatic, daily cron), `pending|overdue
 * -> settled` (ONLY via a validated grattage reconciliation Deposit — never
 * a direct admin action), `pending|overdue -> cancelled` (admin, THIS
 * phase, via `SalesService::cancelSale`, stock-safe).
 *
 * `depositId` (`deposit_id`) IS THE CANCELLATION-FREEZE GUARD, verified
 * from `GrattageInvoice::isCancellable()` (backend): once a reconciliation
 * deposit has LINKED this invoice (`deposit_id` set — which happens at the
 * deposit's own CREATION, before it is ever validated), the invoice is
 * frozen for cancellation even while still `pending`/`overdue` — cancelling
 * it afterward would corrupt the amount match the deposit was created
 * against. `isCancellable()` below mirrors the backend predicate exactly
 * and is the SINGLE source of truth both the detail page's own button
 * gating and `CancelGrattageInvoiceDialog`'s freshness check reuse — do not
 * duplicate this condition inline elsewhere.
 *
 * `agent`/`client` ARE RAW, UNRESTRICTED NESTED MODELS ON THE WIRE
 * (`GrattageInvoiceController::index`/`show` both eager-load
 * `['agent', 'client', 'sales']` with NO column restriction) — this type
 * models only the fields actually read (ADR-0008), not the full nested
 * payload. `client` has no name field at all (verified from `Client`'s own
 * fillable, backend) — `phone` is its only identifier, the same convention
 * `domains/network/clients` already established.
 *
 * `sales` LINES CARRY `productId` ONLY, NO NESTED PRODUCT — `GrattageSale`
 * has a `product()` relation, but it is never eager-loaded by this
 * controller (verified from source). The detail page resolves a display
 * name via the existing `useProductOptionsQuery()` (Reference domain,
 * already public), not a new read.
 *
 * NO DOCUMENT NUMBER — verified from `grattage_invoices`' own migration:
 * no `invoice_number`/similar column exists. The invoice is identified by
 * `#id` only, unlike Bons'/Allocations'/Transfers' own backend-generated
 * document numbers.
 */

export const GRATTAGE_INVOICE_STATUSES = [
  "pending",
  "overdue",
  "settled",
  "cancelled",
] as const;
export type GrattageInvoiceStatus = (typeof GRATTAGE_INVOICE_STATUSES)[number];

export const GRATTAGE_INVOICE_STATUS_LABELS: Record<GrattageInvoiceStatus, string> = {
  pending: "Pending",
  overdue: "Overdue",
  settled: "Settled",
  cancelled: "Cancelled",
};

/**
 * Design System §17's own canonical mapping for this exact vocabulary:
 * pending -> warning, settled -> success, overdue -> danger,
 * cancelled -> muted (outlined) — copied verbatim from the frozen table,
 * not derived by resemblance to any other domain's own four-state set.
 */
export const GRATTAGE_INVOICE_STATUS_TONES: Record<GrattageInvoiceStatus, StatusTone> = {
  pending: "warning",
  overdue: "danger",
  settled: "success",
  cancelled: "muted",
};

export type GrattageInvoiceSaleLine = {
  id: number;
  productId: number;
  quantity: number;
  /** `decimal:2`-cast STRING — same verbatim discipline as `totalAmount`. */
  unitPrice: string;
  total: string;
};

export type GrattageInvoice = {
  id: number;
  status: GrattageInvoiceStatus;
  /** `decimal:2`-cast STRING — see the module docblock. Render verbatim. */
  totalAmount: string;
  /** ISO-8601 — when the retail sale happened (`datetime` cast, standard Carbon serialization). */
  soldAt: string;
  /** ISO-8601 — the next-day 12:00 settlement deadline. */
  dueAt: string;
  /** ISO-8601, or `null` — never set by the current commercial-facing create flow (verified from `SalesService::createSale`), but nullable and mapped defensively. */
  declaredAt: string | null;
  agentId: number;
  agentName: string;
  agentAccountNumber: string;
  clientId: number;
  clientPhone: string;
  /**
   * The reconciliation deposit this invoice is linked to, or `null`. See
   * the module docblock — `!== null` freezes cancellation even before the
   * deposit is validated. Rendered as plain text on the detail page in
   * this phase (no cross-link to `/money/deposits/{id}` — that
   * integration is explicitly out of scope for Phase 1).
   */
  depositId: number | null;
  /** Present on BOTH `index()` and `show()` (re-verified, Client 360 Phase 3 — see `api/grattage-invoices-api.ts`'s own docblock; this comment previously claimed index() omits it, which is now stale). Still optional: a raw, non-Resource serialization gives no compile-time guarantee. */
  sales?: GrattageInvoiceSaleLine[];
};

/**
 * Mirrors `GrattageInvoice::isCancellable()` exactly (backend) — the
 * single source of truth for both the detail page's Cancel-button gating
 * and the cancel dialog's freshness `hasChanged` predicate. Takes a
 * narrow, structural slice rather than the full type so both call sites
 * (a full invoice, a freshness-query result) can share it without a cast.
 */
export function isGrattageInvoiceCancellable(
  invoice: Pick<GrattageInvoice, "status" | "depositId">,
): boolean {
  return (
    (invoice.status === "pending" || invoice.status === "overdue") &&
    invoice.depositId === null
  );
}

/**
 * The list query surface, mirroring `GrattageInvoiceController::index`'s
 * own validator exactly (verified from source): `status`
 * (`all|pending|overdue|settled|cancelled`), `agent_id`, `client_id`,
 * `date_from`/`date_to` (filtering `created_at`, NOT `sold_at` — the two
 * are set together at creation and never diverge in practice, but the
 * WIRE filter targets `created_at`), `per_page`.
 *
 * PHASE 1 SCOPE: only `status` and the date range are exposed as UI
 * filters — `agent_id`/`client_id` are supported server-side but would
 * need their own cross-domain picker (mirroring Deposits' own merged
 * Managers+Commercials filter), which is deliberately out of this phase's
 * narrow scope (list/detail/cancel + freshness + the deposit-link guard).
 * NO `per_page` CONTROL — same restraint every prior domain's list applies
 * when the backend accepts but does not require one; the backend's own
 * default (15) applies when omitted.
 */
export type GrattageInvoiceListParams = {
  page: number;
  status: GrattageInvoiceStatus | "";
  dateFrom: string;
  dateTo: string;
};

export const GRATTAGE_INVOICE_LIST_DEFAULTS: GrattageInvoiceListParams = {
  page: 1,
  status: "",
  dateFrom: "",
  dateTo: "",
};

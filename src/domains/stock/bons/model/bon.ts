import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * A Bon — the fifth and final Stock resource (roadmap M5, Phase 5). A
 * supplier hands stock UP into a company's own inventory: `draft -> add
 * lines -> validate`, the same lifecycle shape as the other three, but
 * genuinely different in several verified ways (ADR-0022 — NOT copied
 * from Allocation's/Transfer's/Return's own model and edited):
 *
 * THE ONLY STOCK RESOURCE WITH A REAL CANCEL LIFECYCLE. Confirmed from
 * source (`routes/api.php`'s `bons` group is the only one with a
 * `/cancel` route — BC-AB). `cancel-bon` is super-admin only (excluded
 * from `BonPermissions::ADMIN_GRANTS`), same posture as `validate-bon`.
 * Cancelling a VALIDATED bon reverses its stock; it can fail with
 * `BON_CANCEL_STOCK_INSUFFICIENT` if that stock was already drawn down
 * elsewhere (e.g. a later Allocation) by the time cancellation is
 * attempted — a real, live 409, not a hypothetical.
 *
 * THE ONLY STOCK RESOURCE WITH A MANDATORY FILE UPLOAD. `evidence` is
 * `required|file|mimes:jpeg,png,jpg,pdf|max:5120` on create — 5MB, NOT
 * the M3.6 onboarding wizard's 2MB cap; a genuinely different limit, not
 * copied from that precedent. Exposed here as `evidenceUrl` (an unsigned
 * public URL, verified from `SupplierBonService`'s own docblock — anyone
 * with the URL can read the file; UUID filenames are collision-free, NOT
 * secret) and `evidenceName` (`null` together, never independently).
 *
 * `montant` IS METADATA-ONLY (same as Return's/Transfer's own, NOT
 * Allocation's load-bearing one) — `validateBon()` has NO capacity or
 * stock-sufficiency check at all; a bon is the SOURCE of stock, not a
 * consumer of it. The only stock-insufficiency gate in this whole
 * resource is `BON_CANCEL_STOCK_INSUFFICIENT`, reached only via cancel.
 *
 * `validationSummary` HAS ONLY TWO KEYS — `{lineCount, totalQuantity}` —
 * verified directly from the backend's own `ValidationSummary::fromLines()`
 * helper, which deliberately excludes `montant`/`total_montant`. Every
 * other Stock resource's own summary carries three keys; do not add a
 * third key here to "match" them.
 *
 * `receivedAt` IS DATE-ONLY (`YYYY-MM-DD`), NOT a datetime — mirrors
 * Transfer's own `transferDate` precedent. The backend additionally
 * refuses a FUTURE `received_at` (a custom `Closure` validator, not just
 * `date`) — mirrored client-side in `model/create-bon.ts`.
 *
 * `supplier`/`company` USE `{id, name}` (`idName()` helper) — NEITHER
 * carries `active` on this read shape (confirmed from `BonResource`'s own
 * docblock: "Phase 4A intentionally does NOT enforce active-state
 * validation on bon creation; surfacing the flag on the read shape would
 * imply a constraint that does not exist").
 *
 * `cancelledById` IS A RAW ID, NOT A RESOLVED NAME — unlike `creator`/
 * `approver`, `BonController` never eager-loads a `cancelledBy` relation
 * on any response (confirmed from source: every eager-load list is
 * `['supplier','company','admin','approver','lines.product']`), so there
 * is no name to resolve. The detail page does not render "Cancelled by"
 * for this reason — showing a bare numeric ID where every other actor
 * field in this product shows a name would be a real UX regression, not
 * an omission to fix later.
 *
 * `lines`/`validationSummary` ARE OPTIONAL ON THE TYPE — present on
 * `show()` and every line-mutation response, absent on `index()` rows,
 * the same "present on show, absent on list" modelling every other Stock
 * resource's own type already established.
 */

export const BON_STATUSES = ["draft", "validated", "cancelled"] as const;
export type BonStatus = (typeof BON_STATUSES)[number];

export const BON_STATUS_LABELS: Record<BonStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  cancelled: "Cancelled",
};

export const BON_STATUS_TONES: Record<BonStatus, StatusTone> = {
  draft: "warning",
  validated: "success",
  cancelled: "muted",
};

export type BonLine = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  /** A `decimal:2`-cast STRING, or `null` — Bon's own line `unit_cost` is nullable, unlike Allocation's/Transfer's/Return's. Render verbatim. */
  unitCost: string | null;
  notes: string | null;
};

export type Bon = {
  id: number;
  bonNumber: string;
  status: BonStatus;
  /** Metadata-only, `decimal:2`-cast STRING — see the module docblock. */
  montant: string;
  notes: string | null;
  supplierId: number;
  supplierName: string;
  companyId: number;
  companyName: string;
  /** Both present together, or both `null` together — no evidence was ever uploaded (never possible on create; only relevant if a future edit path clears it). */
  evidenceUrl: string | null;
  evidenceName: string | null;
  /** `YYYY-MM-DD`, or `null` — date-only, not a datetime. */
  receivedAt: string | null;
  createdByName: string;
  approvedByName: string | null;
  /** ISO-8601, or `null` while still a draft. */
  approvedAt: string | null;
  /** ISO-8601, or `null` unless cancelled. */
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  /** Present on `show()` and every line-mutation response; absent on `index()` rows. */
  lines?: BonLine[];
  /** ONLY `{lineCount, totalQuantity}` — no `montant` key, see the module docblock. */
  validationSummary?: {
    lineCount: number;
    totalQuantity: number;
  };
};

/**
 * The list query surface, mirroring `IndexBonRequest`'s own validator
 * exactly (verified from source): `status`, `supplier_id`, `company_id`,
 * `sort` (`received_at`|`created_at`|`bon_number`), `direction`. NO
 * PER-PAGE CONTROL — same restraint every prior Stock resource's own
 * list already applies; the backend's own default (15) applies when
 * omitted.
 */
export type BonListParams = {
  page: number;
  status: BonStatus | "";
  supplierId: string;
  companyId: string;
  sort: "received_at" | "created_at" | "bon_number" | "";
  direction: "asc" | "desc" | "";
};

export const BON_LIST_DEFAULTS: BonListParams = {
  page: 1,
  status: "",
  supplierId: "",
  companyId: "",
  sort: "",
  direction: "",
};

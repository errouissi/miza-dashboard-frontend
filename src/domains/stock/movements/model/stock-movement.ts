import type { Operator } from "@/domains/reference/products";

/**
 * The Stock Movements read (Phase 2A) — the authoritative, paginated,
 * newest-first audit ledger from `GET /admin/stock/movements`
 * (`StockService::paginateMovements()`), verified fresh from source this
 * session — including two real Postman-found public-contract defects
 * (`type`/`from`/`to` silently ignored, then a validation-failure
 * content-negotiation bug) fixed in the backend earlier this same session.
 *
 * `movementTypeLabel` IS THE BACKEND'S OWN HUMAN-READABLE LABEL, rendered
 * verbatim — this domain deliberately builds NO frontend movement-type
 * label map. Duplicating that business mapping client-side would drift the
 * moment the backend's own `MOVEMENT_TYPE_LABELS` changes.
 *
 * `actor` IS DELIBERATELY ABSENT FROM THIS MODEL — the backend never
 * populates it (`'actor' => null, // No actor/created_by column exists on
 * stock_movements today`, confirmed from source). Modelling a field with
 * no real value would misrepresent the contract (mirrors `Product`'s own
 * "no caller, no field" discipline, FTA D-11) — the approved Phase 2 plan
 * omits the Actor column entirely, not a permanent dash.
 *
 * `source`/`destination`/`reference` ARE ALL INDEPENDENTLY NULLABLE — the
 * domain genuinely has no holder/reference on one side for several real
 * movement types (e.g. `client_sale_reversal` has no `source`); never
 * fabricated, rendered as absent by the caller.
 *
 * `operator` (on `product`) REUSES THE EXISTING `Operator` TYPE from
 * `domains/reference/products` — NOT redeclared here, same reasoning as
 * `StockOverviewProduct`'s own `operator` field.
 */
export type StockMovementHolder = {
  type: string;
  id: number;
  label: string | null;
};

export type StockMovementReference = {
  type: string;
  id: number;
};

export type StockMovement = {
  id: number;
  /** ISO-8601, or `null` in the (currently unreachable) case the column is ever unset. */
  createdAt: string | null;
  /** The stable machine value (e.g. `"client_sale"`) — a filter value, never displayed directly. */
  movementType: string;
  /** The backend's own truthful label — render this, not `movementType`. */
  movementTypeLabel: string;
  status: string;
  quantity: number;
  product: { id: number; name: string; operator: Operator; value: number } | null;
  source: StockMovementHolder | null;
  destination: StockMovementHolder | null;
  reference: StockMovementReference | null;
};

/**
 * The list query surface — mirrors the approved public wire contract
 * EXACTLY: `type`, `operator`, `product_id`, `from`, `to`, `page`. NO
 * `per_page` field — Phase 2 uses the backend default (15) by decision, no
 * page-size control.
 */
export type StockMovementListParams = {
  page: number;
  type: string;
  operator: Operator | "";
  productId: string;
  from: string;
  to: string;
};

export const STOCK_MOVEMENT_LIST_DEFAULTS: StockMovementListParams = {
  page: 1,
  type: "",
  operator: "",
  productId: "",
  from: "",
  to: "",
};

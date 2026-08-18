import type { Operator } from "@/domains/reference/products";

/**
 * The Stock Overview / Inventory read (Phase 2A) — one authoritative,
 * unpaginated aggregate from `GET /admin/stock`
 * (`StockService::aggregateInventory()`), verified fresh from source this
 * session. One row per product, network-wide: current physical balance
 * broken down by holder class (company/manager/commercial), plus network
 * summary totals.
 *
 * `operator` REUSES THE EXISTING `Operator` TYPE from
 * `domains/reference/products` — NOT redeclared here. Products' own
 * `IAM|INWI|ORANGE` enum is the identical backend vocabulary
 * (`in:IAM,INWI,ORANGE`), and this is a genuine second real caller of that
 * domain's public surface (widened this phase — see that domain's own
 * `index.ts`).
 *
 * ALL QUANTITY/VALUE FIELDS ARE PLAIN INTEGERS — verified from source
 * (`StockService::aggregateInventory()`'s own docblock: "stable PHP `int`
 * types even for an empty product/stock dataset", never a decimal string).
 * `value`/`*_value` render through the existing `<MoneyAmount>` component
 * exactly like Products' own `value` field already does — never treated as
 * a `decimal`-cast STRING the way Bons'/Cheques'/Deposits' own amount
 * fields must be.
 *
 * NO CLIENT-SIDE AGGREGATION IS EVER PERFORMED ON THIS MODEL — every
 * summary figure is read directly from the backend's own `summary` object,
 * never summed from `products[]` client-side (CLAUDE.md: no frontend
 * business calculations that should remain backend-authoritative).
 */
export type StockOverviewProduct = {
  productId: number;
  operator: Operator;
  name: string;
  /** Face value in dirhams — an integer, same convention as `Product.value`. */
  value: number;
  companyQuantity: number;
  managerQuantity: number;
  commercialQuantity: number;
  totalQuantity: number;
  companyValue: number;
  managerValue: number;
  commercialValue: number;
  totalValue: number;
};

/**
 * Network-wide summary totals — backend-computed, never derived
 * client-side. `companyOutOfStockProducts`/`networkOutOfStockProducts` are
 * TWO DISTINCT counts (a product can count toward the first without the
 * second — see the backend's own docblock), never collapsed into one.
 */
export type StockOverviewSummary = {
  totalUnits: number;
  totalStockValue: number;
  companyOutOfStockProducts: number;
  networkOutOfStockProducts: number;
};

export type StockOverview = {
  products: StockOverviewProduct[];
  summary: StockOverviewSummary;
};

export { PRODUCTS_PATH, productsRoutes } from "./routes";

/**
 * The product set, for line-item pickers in sibling domains (FTA §4 — a
 * domain may read another's public surface with a documented coupling).
 *
 * Added now, against the real caller (roadmap M5 Phase 1's
 * `LineItemsEditor`, consumed by Agent Stock Returns) — exactly as
 * `useManagerOptionsQuery`'s own export was added at M3.3 against its own
 * real caller, not ahead of one.
 */
export { useProductOptionsQuery } from "./queries/products-queries";
export type { ProductOption } from "./model/product";

/**
 * The Operator vocabulary — widened at Stock Overview/Movements' own
 * Phase 2A (`domains/stock/overview`, `domains/stock/movements`), a real
 * second cross-domain caller: Stock's own `operator` field is the
 * identical backend enum (`in:IAM,INWI,ORANGE`). Mirrors how
 * `useProductOptionsQuery` was itself exported at its own first real
 * caller (M5 Phase 1) — not ahead of one.
 */
export { OPERATORS, isOperator } from "./model/product";
export type { Operator } from "./model/product";

// api/, the list query, mutations, components and the page stay internal.
// Siblings get the options picker surface and the Operator vocabulary
// above — nothing else.

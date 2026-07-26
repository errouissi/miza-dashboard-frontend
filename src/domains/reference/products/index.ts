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

// api/, the list query, mutations, components and the page stay internal.
// Siblings get the options picker surface above — nothing else.

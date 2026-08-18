import type { StockMovementListParams } from "../model/stock-movement";

/**
 * The Stock Movements query-key factory (FTA §8) — FLAT, matching every
 * Stock resource's own already-established deviation from FTA §8's
 * `[domain,resource,...]` prose.
 */
export const stockMovementsKeys = {
  all: ["stock-movements"] as const,
  lists: () => [...stockMovementsKeys.all, "list"] as const,
  list: (params: StockMovementListParams) =>
    [...stockMovementsKeys.lists(), params] as const,
};

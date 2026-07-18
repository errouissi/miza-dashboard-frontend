import type { ProductListParams } from "../model/product";

/**
 * The Products query-key factory (FTA §8).
 *
 * MUST be the only source of a products key — an inline key array is how two
 * components cache the same endpoint under different keys and then disagree.
 *
 * The list key carries the filter, so switching operators back and forth reads
 * cache rather than refetching.
 */
export const productsKeys = {
  all: ["products"] as const,
  lists: () => [...productsKeys.all, "list"] as const,
  list: (params: ProductListParams) => [...productsKeys.lists(), params] as const,
};

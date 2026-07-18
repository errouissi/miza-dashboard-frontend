import type { VilleListParams } from "../model/ville";

/**
 * The Villes query-key factory (FTA §8) — the first one in the codebase.
 *
 * MUST be the only source of a villes key. A key array typed inline at a call
 * site is how two components end up caching the same endpoint under slightly
 * different keys, fetching twice and disagreeing about the result.
 *
 * The list key carries the full parameter set, so every filter/sort/page
 * combination is its own cache entry and going back to a previous page is
 * instant rather than a refetch.
 */
export const villesKeys = {
  all: ["villes"] as const,
  lists: () => [...villesKeys.all, "list"] as const,
  list: (params: VilleListParams) => [...villesKeys.lists(), params] as const,
  /**
   * The relation-picker set. A single key with no parameters, so every consumer
   * — a form's select, a table resolving a ville name — reads ONE cache entry
   * and triggers ONE fetch, however many components ask for it.
   */
  options: () => [...villesKeys.all, "options"] as const,
};

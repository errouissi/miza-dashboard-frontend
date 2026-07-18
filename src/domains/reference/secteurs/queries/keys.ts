import type { SecteurListParams } from "../model/secteur";

/**
 * The Secteurs query-key factory (FTA §8).
 *
 * MUST be the only source of a secteurs key — an inline key array is how two
 * components cache the same endpoint under different keys and then disagree.
 *
 * The list key carries the filter, so switching villes back and forth reads cache
 * rather than refetching.
 */
export const secteursKeys = {
  all: ["secteurs"] as const,
  lists: () => [...secteursKeys.all, "list"] as const,
  list: (params: SecteurListParams) => [...secteursKeys.lists(), params] as const,
};

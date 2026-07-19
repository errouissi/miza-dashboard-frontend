import type { ManagerListParams } from "../model/manager";

/**
 * The Managers query-key factory (FTA §8).
 *
 * MUST be the only source of a managers key. Parameterised, unlike `adminsKeys` —
 * that endpoint accepts nothing to key on, this one accepts eight parameters, so
 * every page/search/filter combination is its own cache entry and paging back is
 * instant rather than a refetch.
 *
 * NOT merged with any other domain's factory (ADR-0012). Four lines and fully
 * typed is not duplication worth removing.
 */
export const managersKeys = {
  all: ["managers"] as const,
  lists: () => [...managersKeys.all, "list"] as const,
  list: (params: ManagerListParams) => [...managersKeys.lists(), params] as const,
};

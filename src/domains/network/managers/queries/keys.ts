import type { ManagerListParams, ManagerStatus } from "../model/manager";

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
  /**
   * The relation-picker set (M3.3's Commercials manager filter). A bare call
   * (no `status`) keeps the EXACT SAME key every existing caller already
   * uses — backward compatible. A `status`-scoped call (Allocations' create
   * form, roadmap M5, Phase 4, which needs `status=active` only) gets its
   * OWN distinct key, not sharing the unfiltered set's cache entry.
   */
  options: (status?: ManagerStatus) =>
    status
      ? ([...managersKeys.all, "options", status] as const)
      : ([...managersKeys.all, "options"] as const),
};

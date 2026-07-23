import type { CommercialListParams } from "../model/commercial";

/**
 * The Commercials query-key factory (FTA §8).
 *
 * MUST be the only source of a commercials key. NOT merged with `managersKeys`
 * (ADR-0012) despite the near-identical shape — this is the point of that
 * decision, not an oversight.
 */
export const commercialsKeys = {
  all: ["commercials"] as const,
  lists: () => [...commercialsKeys.all, "list"] as const,
  list: (params: CommercialListParams) => [...commercialsKeys.lists(), params] as const,
  /**
   * The relation-picker set (M3.5's Clients bulk-assign sheet). One
   * parameterless key, mirroring `managersKeys.options()` — every consumer
   * reads the same cache entry and triggers one fetch, however many
   * components ask.
   */
  options: () => [...commercialsKeys.all, "options"] as const,
};

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
};

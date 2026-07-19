import type { ClientListParams } from "../model/client";

/**
 * The Clients query-key factory (FTA §8).
 *
 * MUST be the only source of a clients key. NOT merged with any Agent
 * domain's factory (ADR-0012) despite the similar shape — that is the point
 * of that decision, not an oversight.
 */
export const clientsKeys = {
  all: ["clients"] as const,
  lists: () => [...clientsKeys.all, "list"] as const,
  list: (params: ClientListParams) => [...clientsKeys.lists(), params] as const,
};

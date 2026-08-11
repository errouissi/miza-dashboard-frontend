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
  /**
   * Client 360 (M7 Phase 1) — mirrors `agentsKeys.details()`/`.detail(id)`'s
   * own shape exactly (`domains/network/agents/queries/keys.ts`).
   */
  details: () => [...clientsKeys.all, "detail"] as const,
  detail: (id: number) => [...clientsKeys.details(), id] as const,
};

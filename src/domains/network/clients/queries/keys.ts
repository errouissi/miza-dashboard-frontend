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

/**
 * Client 360 Phase 2 — a SEPARATE, FLAT top-level key space, not nested
 * under `clientsKeys.all`. Mirrors `commercialStockQuantityKeys`'s own
 * reasoning (`domains/network/agents/queries/keys.ts`): assignment history
 * is a genuinely different resource (an append-only audit log, paginated by
 * its own `page`) from the identity read `clientsKeys.detail` serves — a
 * broad `clientsKeys.all` invalidation (e.g. from `"agent.updated"`-class
 * events elsewhere in the product) must not be assumed to bust this cache
 * too, and vice versa. Every ownership-changing mutation invalidates BOTH
 * key spaces explicitly, never one implying the other.
 */
export const clientAssignmentHistoryKeys = {
  all: ["client-assignment-history"] as const,
  details: (clientId: number) => [...clientAssignmentHistoryKeys.all, clientId] as const,
  detail: (clientId: number, page: number) =>
    [...clientAssignmentHistoryKeys.details(clientId), page] as const,
};

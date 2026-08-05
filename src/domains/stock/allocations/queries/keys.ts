import type { AllocationListParams } from "../model/allocation";

/**
 * The Allocations query-key factory (FTA §8) — FLAT, matching every Money
 * resource's and both prior Stock resources' own already-established
 * deviation from FTA §8's `[domain,resource,...]` prose.
 */
export const allocationsKeys = {
  all: ["allocations"] as const,
  lists: () => [...allocationsKeys.all, "list"] as const,
  list: (params: AllocationListParams) => [...allocationsKeys.lists(), params] as const,
  details: () => [...allocationsKeys.all, "detail"] as const,
  detail: (id: number) => [...allocationsKeys.details(), id] as const,
  /**
   * The freshness-rule read (M4 · G4 closure precedent, reused here exactly
   * as Return's/Transfer's own) — its OWN key, deliberately NOT `detail(id)`.
   * See `chequesKeys.freshness`'s own docblock for why: sharing the detail
   * key would let a transient verification failure flip the host page's own
   * detail query into an error state too.
   */
  freshness: (id: number) => [...allocationsKeys.detail(id), "freshness"] as const,
};

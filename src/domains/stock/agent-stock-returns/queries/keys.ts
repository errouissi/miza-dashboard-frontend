import type { AgentStockReturnListParams } from "../model/agent-stock-return";

/**
 * The Agent Stock Returns query-key factory (FTA §8) — FLAT, matching
 * every Money resource's own already-established deviation from FTA §8's
 * `[domain,resource,...]` prose (each domain's own `keys.ts` carries the
 * full reasoning; not re-derived here, the same convention applies).
 */
export const agentStockReturnsKeys = {
  all: ["agent-stock-returns"] as const,
  lists: () => [...agentStockReturnsKeys.all, "list"] as const,
  list: (params: AgentStockReturnListParams) =>
    [...agentStockReturnsKeys.lists(), params] as const,
  details: () => [...agentStockReturnsKeys.all, "detail"] as const,
  detail: (id: number) => [...agentStockReturnsKeys.details(), id] as const,
  /**
   * The freshness-rule read (M4 · G4 closure precedent) — its OWN key,
   * deliberately NOT `detail(id)`. See `chequesKeys.freshness`'s own
   * docblock for why: sharing the detail key would let a transient
   * verification failure flip the host page's own detail query into an
   * error state too.
   */
  freshness: (id: number) => [...agentStockReturnsKeys.detail(id), "freshness"] as const,
  /**
   * The Create form's manager-scoped commercial picker
   * (`fetchManagerCommercials`) — keyed by manager id, kept under this
   * domain's own `["agent-stock-returns"]` prefix rather than a Network
   * key, mirroring Deposits' own "keep the read inside the domain that
   * needs it" precedent (Phase 4's `agentCash`/`grattageOutstanding`).
   */
  managerCommercials: (managerId: string) =>
    [...agentStockReturnsKeys.all, "managerCommercials", managerId] as const,
};

import type { AgentTransferListParams } from "../model/agent-transfer";

/**
 * The Agent Transfers query-key factory (FTA §8) — FLAT, matching every
 * Money resource's and Agent Stock Return's own already-established
 * deviation from FTA §8's `[domain,resource,...]` prose.
 */
export const agentTransfersKeys = {
  all: ["agent-transfers"] as const,
  lists: () => [...agentTransfersKeys.all, "list"] as const,
  list: (params: AgentTransferListParams) =>
    [...agentTransfersKeys.lists(), params] as const,
  details: () => [...agentTransfersKeys.all, "detail"] as const,
  detail: (id: number) => [...agentTransfersKeys.details(), id] as const,
  /**
   * The freshness-rule read (M4 · G4 closure precedent, reused here exactly
   * as Return's own) — its OWN key, deliberately NOT `detail(id)`. See
   * `chequesKeys.freshness`'s own docblock for why: sharing the detail key
   * would let a transient verification failure flip the host page's own
   * detail query into an error state too.
   */
  freshness: (id: number) => [...agentTransfersKeys.detail(id), "freshness"] as const,
  /**
   * The Create form's manager-scoped commercial picker
   * (`fetchManagerCommercials`) — keyed by manager id, kept under this
   * domain's own `["agent-transfers"]` prefix rather than a Network key,
   * mirroring Return's own precedent.
   */
  managerCommercials: (managerId: string) =>
    [...agentTransfersKeys.all, "managerCommercials", managerId] as const,
};

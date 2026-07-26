import type { DepositListParams } from "../model/deposit";

/**
 * The Deposits query-key factory (FTA §8) — FLAT, matching `chequesKeys`'s
 * own already-established deviation from FTA §8's `[domain,resource,...]`
 * prose (`queries/keys.ts` in `money/cheques` carries the full reasoning;
 * not re-derived here, the same convention applies).
 */
export const depositsKeys = {
  all: ["deposits"] as const,
  lists: () => [...depositsKeys.all, "list"] as const,
  list: (params: DepositListParams) => [...depositsKeys.lists(), params] as const,
  details: () => [...depositsKeys.all, "detail"] as const,
  detail: (id: number) => [...depositsKeys.details(), id] as const,
  /**
   * `fetchAgentCash`/`fetchGrattageOutstanding` (M4.3 Phase 4) — Create
   * Deposit's own reads, keyed by agent id. Kept under `depositsKeys`, NOT
   * a Network-domain key, per the confirmed decision to keep both reads
   * inside the Deposits domain (no cross-domain query-key coupling either).
   */
  agentCash: (agentId: string) => [...depositsKeys.all, "agentCash", agentId] as const,
  grattageOutstanding: (agentId: string) =>
    [...depositsKeys.all, "grattageOutstanding", agentId] as const,
  /**
   * The freshness-rule read (M4 · G4 closure) — its OWN key, deliberately
   * NOT the same key as `detail(id)`. See `chequesKeys.freshness`'s own
   * docblock for why: TanStack Query's error/success state is per query
   * key, shared across every observer of it, so reusing `detail(id)` would
   * mean a transient failure of the pre-confirm freshness check flips the
   * host page's own detail query into its error state too. A distinct key
   * isolates the check to the dialog; it still sits under the
   * `["deposits"]` prefix, so existing `deposit.validated`/`rejected`
   * invalidations still reach it (harmless — `enabled: false`, unobserved
   * once its dialog closes).
   */
  freshness: (id: number) => [...depositsKeys.detail(id), "freshness"] as const,
};

import type { BonListParams } from "../model/bon";

/**
 * The Bons query-key factory (FTA §8) — FLAT, matching every Money
 * resource's and every prior Stock resource's own already-established
 * deviation from FTA §8's `[domain,resource,...]` prose.
 */
export const bonsKeys = {
  all: ["bons"] as const,
  lists: () => [...bonsKeys.all, "list"] as const,
  list: (params: BonListParams) => [...bonsKeys.lists(), params] as const,
  details: () => [...bonsKeys.all, "detail"] as const,
  detail: (id: number) => [...bonsKeys.details(), id] as const,
  /**
   * The freshness-rule read (M4 · G4 closure precedent) — its OWN key,
   * deliberately NOT `detail(id)` (ADR-0018). SHARED BY BOTH `ValidateBonDialog`
   * AND `CancelBonDialog` — an explicit decision for this phase: both read
   * the exact same underlying resource freshness (`fetchBonById`), so one
   * cache entry serves either dialog (only one is ever open at a time).
   * Each dialog supplies its OWN `hasChanged` predicate to `useFreshConfirm`
   * (`status !== "draft"` for Validate, `status !== "validated"` for
   * Cancel) — sharing the QUERY does not couple the two dialogs' business
   * logic, which stays fully independent.
   */
  freshness: (id: number) => [...bonsKeys.detail(id), "freshness"] as const,
};

import type { ChequeListParams, PendingChequeListParams } from "../model/cheque";

/**
 * The Cheques query-key factory (FTA §8).
 *
 * MUST be the only source of a cheques key. `["cheques"]`, flat — NOT
 * `["money","cheques"]`. FTA §8's own worked example writes Money keys as
 * `[domain, resource, scope, params]` (e.g. `['money','cheques','list',...]`),
 * but every existing resource's factory in this codebase (Villes, Secteurs,
 * Products, Admins, Managers, Commercials, Clients — four-for-four of the
 * paginated ones) uses a FLAT `[resource, scope, params]` shape with no
 * domain segment. That is a real discrepancy between the frozen document's
 * prose and the established, unanimous precedent — raised, not silently
 * resolved either way (see this phase's report). This factory follows the
 * existing codebase convention, per this phase's own explicit instruction
 * to follow existing architecture; `invalidation-map.ts` entries registered
 * in a later M4.2 phase should invalidate the prefix `["cheques"]`
 * accordingly, not `["money","cheques"]`.
 */
export const chequesKeys = {
  all: ["cheques"] as const,
  lists: () => [...chequesKeys.all, "list"] as const,
  list: (params: ChequeListParams) => [...chequesKeys.lists(), params] as const,
  details: () => [...chequesKeys.all, "detail"] as const,
  detail: (id: number) => [...chequesKeys.details(), id] as const,
  /**
   * The pending queue — its own scope under `["cheques"]`, separate from
   * `lists()`. `GET /admin/cheques/pending` is a distinct endpoint with its
   * own permission (`view-pending-cheques`), not a filtered view of
   * `lists()`, so it does not share that scope's key space.
   */
  pendingLists: () => [...chequesKeys.all, "pending"] as const,
  pendingList: (params: PendingChequeListParams) =>
    [...chequesKeys.pendingLists(), params] as const,
  /**
   * The freshness-rule read (M4 · G4 closure) — its OWN key, deliberately
   * NOT the same key as `detail(id)`. TanStack Query's error/success state
   * is per QUERY KEY, shared across every observer of it — sharing
   * `detail(id)` would mean a transient failure of the pre-confirm
   * freshness check flips the HOST PAGE's own detail query into its error
   * state too (verified empirically: a naive same-key design did exactly
   * this during implementation). A distinct key isolates the check to the
   * dialog; it still sits under the `["cheques"]` prefix, so existing
   * `cheque.approved`/`rejected`/`annuled` invalidations still reach it
   * (harmless — it is `enabled: false` and unobserved once its dialog closes).
   */
  freshness: (id: number) => [...chequesKeys.detail(id), "freshness"] as const,
};

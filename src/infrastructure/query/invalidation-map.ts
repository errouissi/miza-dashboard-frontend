import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * The cross-domain cache invalidation map (FTA §4, §8 — D-3).
 *
 * A mutation whose effects the backend propagates across domains does NOT
 * import the other domain's query keys and invalidate them directly — that
 * quietly makes the mutating domain depend on every domain it ever affects,
 * and the coupling stays invisible (nothing lists which mutations touch
 * which caches). Instead, the mutation announces a named DOMAIN EVENT (e.g.
 * `cheque.approved`) and knows nothing else. This ONE file declares which
 * query-key prefixes, across every domain, each event invalidates — the
 * single, greppable answer to "what happens when a cheque is approved?".
 *
 * ENTRIES SHIPPED EMPTY AT M4.1 — Money, the first domain to emit a real
 * event, was not built yet. `cheque.created` (M4.2 Phase 3A) is the FIRST
 * real entry: registered from a real mutation (`useCreateChequeMutation`),
 * not ahead of one (`session-bootstrap.md`'s own rule). `cheque.approved`/
 * `cheque.rejected`/`cheque.annuled` (M4.2 Phase 3C) are now registered too,
 * from `useApproveChequeMutation`/`useRejectChequeMutation`/
 * `useAnnulerChequeMutation` — see each entry below for why it invalidates
 * what it does. `deposit.validated`/`deposit.rejected` (M4.3 Phase 3) are
 * the first Deposits entries, from `useValidateDepositMutation`/
 * `useRejectDepositMutation`.
 *
 * The mechanism, the fallback, and its test shipped at M4.1 — mirrors
 * `infrastructure/errors/error-code-registry.ts` exactly: an empty, frozen
 * registry, a lookup that degrades safely (an unregistered event
 * invalidates nothing rather than throwing), populated per event as real
 * mutations arrive, never ahead of them.
 */

/**
 * A domain event name, e.g. `"cheque.approved"`. Kept as a plain `string`
 * rather than a literal union — this registry is infrastructure and may
 * not import a domain's own event-name constants (the dependency direction
 * is `app -> domains -> shared -> infrastructure`, never the reverse), so
 * there is no domain-owned union type it could narrow to without inverting
 * that rule.
 */
export type DomainEvent = string;

/**
 * event -> the query-key PREFIXES it invalidates, across every domain that
 * cares. A prefix, not a full key: invalidating `['network','managers']`
 * refreshes every Managers view at once (list, and any future detail),
 * exactly as invalidating a resource's own key space already does today.
 *
 * `["cheques"]` is a LITERAL, not an import of `chequesKeys.all` — this
 * file cannot import a domain's key factory (same dependency-direction
 * reason `DomainEvent` stays a plain `string`, above). It is the flat shape
 * Cheques' own factory actually uses (`queries/keys.ts`'s own docblock
 * flags the same discrepancy with FTA §8's `[domain,resource,...]` prose) —
 * keep the two in sync by hand if that key's shape ever changes.
 */
const INVALIDATION_MAP: Readonly<Record<DomainEvent, readonly QueryKey[]>> =
  Object.freeze({
    "cheque.created": [["cheques"]],
    /**
     * Approving a cheque writes `agent.montant_avance_rapped` and/or
     * `agent.montant_avance_grattage`, and (for a `rapped` allocation)
     * `agent.solde` too (`ChequeController::approve`, verified from
     * source). Both Managers' and Commercials' own lists render
     * `avanceTotal`, computed from those same columns — invalidating BOTH
     * flat prefixes, not just the one matching the cheque's actual agent
     * role, is deliberate: which role a given `agent_id` holds is not known
     * without an extra read, and over-invalidating a cheap `SLOW`-tier list
     * is far safer than under-invalidating a balance an operator is about
     * to act on.
     */
    "cheque.approved": [["cheques"], ["managers"], ["commercials"]],
    /**
     * Annuler REVERSES the same columns `approve` wrote (per-allocation, or
     * a 100%-rapped legacy fallback) — same two Network prefixes as
     * `cheque.approved`, same reasoning.
     */
    "cheque.annuled": [["cheques"], ["managers"], ["commercials"]],
    /**
     * Reject touches NO balance column at all (verified from source,
     * `ChequeController::reject` — `montant_avance` explicitly stays
     * unchanged) — only Cheques' own key space needs busting.
     */
    "cheque.rejected": [["cheques"]],
    /**
     * Validating a deposit NEVER touches `agent.montant_avance_rapped`/
     * `montant_avance_grattage` — verified from source
     * (`DepoController::validateDepo`, `DepositService::validate`): the
     * rapped path writes `agent.solde`/`agent.cash` only; the grattage path
     * only flips `GrattageInvoice` rows to `settled`. Managers'/
     * Commercials' own `avanceTotal` is computed EXCLUSIVELY from
     * `montant_avance_*` (confirmed by reading both domains' own API
     * mappers — neither reads `solde`/`cash` anywhere), so neither is
     * affected. Unlike `cheque.approved`, NO Network prefix is invalidated
     * here — a genuine difference in what the two actions touch, not an
     * oversight.
     */
    "deposit.validated": [["deposits"]],
    /**
     * Rejecting touches no balance column and no `GrattageInvoice` status
     * (only an unlink, for grattage) — verified from source
     * (`DepositService::reject`).
     */
    "deposit.rejected": [["deposits"]],
    /**
     * Creating a deposit only ever adds a new `pending` row — same
     * reasoning `cheque.created` already established. The legacy
     * rapped+cash-method side effect (`currentAdmin->debt`) touches
     * `User.debt`, a column no Network list renders (re-verified from
     * source this phase, `DepoController::store`).
     */
    "deposit.created": [["deposits"]],
  });

/** The prefixes a given event invalidates, or an empty list for an unregistered one. */
export function queryKeyPrefixesFor(event: DomainEvent): readonly QueryKey[] {
  return INVALIDATION_MAP[event] ?? [];
}

/**
 * Invalidates every query-key prefix registered for `event`. A mutation's
 * `onSuccess` calls this once with the event it just caused — it does not
 * need to know, or list, which OTHER domains' caches that implies.
 *
 * An unregistered event invalidates nothing and does not throw, the same
 * "unhelpful but safe" degradation `error-code-registry.ts` uses — a typo
 * in an event name should not crash a successful mutation.
 */
export function invalidateForEvent(
  queryClient: QueryClient,
  event: DomainEvent,
): Promise<void[]> {
  return Promise.all(
    queryKeyPrefixesFor(event).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

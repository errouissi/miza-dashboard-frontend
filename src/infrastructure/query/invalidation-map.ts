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
 * `cheque.rejected`/`cheque.annuled` — which DO cross into Network's
 * `avanceTotal` — remain unregistered until the mutations that emit them
 * exist (a later M4.2 phase); do not add them speculatively.
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

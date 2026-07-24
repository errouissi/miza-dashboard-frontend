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
 * ENTRIES ARE DELIBERATELY EMPTY AT M4.1.
 * No mutation in this product yet emits a domain event — Money, the first
 * domain that will (`cheque.approved` → Network's `avanceTotal`), is not
 * built yet either. Registering entries ahead of the mutation that emits
 * them would be inventing a contract ahead of a real caller
 * (`session-bootstrap.md`'s own rule). This file ships now so M4.2's first
 * real mutation has somewhere to register on day one, not so it has to
 * invent this mechanism under deadline.
 *
 * The mechanism, the fallback, and its test ship now — mirrors
 * `infrastructure/errors/error-code-registry.ts` exactly: an empty, frozen
 * registry, a lookup that degrades safely (an unregistered event
 * invalidates nothing rather than throwing), populated per event as real
 * mutations arrive, never ahead of them.
 */

/**
 * A domain event name, e.g. `"cheque.approved"`. Kept as a plain `string`
 * while the registry is empty — the same looseness `ERROR_CODES` uses for
 * the identical reason (a literal union with zero members is unusable).
 * Narrow it to a real union once the first events are registered.
 */
export type DomainEvent = string;

/**
 * event -> the query-key PREFIXES it invalidates, across every domain that
 * cares. A prefix, not a full key: invalidating `['network','managers']`
 * refreshes every Managers view at once (list, and any future detail),
 * exactly as invalidating a resource's own key space already does today.
 */
const INVALIDATION_MAP: Readonly<Record<DomainEvent, readonly QueryKey[]>> =
  Object.freeze({});

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

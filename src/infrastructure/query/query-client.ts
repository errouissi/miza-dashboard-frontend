import { QueryClient } from "@tanstack/react-query";
import { MUTATION_RETRY, queryRetryDelay, shouldRetryQuery } from "./retry-policy";
import { DEFAULT_GC_TIME, STALE_TIMES } from "./stale-times";

/**
 * The QueryClient (FTA §8).
 *
 * Query is the server-state layer, and — stated once, because it is the rule most
 * often broken — IT IS ALSO THE CACHE. Server data is never copied into component
 * state, never mirrored into a store, never "kept in sync". There is one copy.
 *
 * DEFAULTS ARE CONSERVATIVE BY DESIGN:
 *
 *   staleTime: CRITICAL (0). A query that does not choose a tier gets the safe
 *   answer, not the convenient one. Longer tiers are opted into explicitly, per
 *   query, which forces the author to state what staleness that data can tolerate.
 *   The inverse default — "5 minutes everywhere" — silently makes every new
 *   financial screen stale by default, and nobody notices until an operator does.
 *
 *   refetchOnWindowFocus: false. Enabled per query for the LIVE tier only.
 *   Refetching a static product list every time someone alt-tabs is pure waste.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.CRITICAL,
        gcTime: DEFAULT_GC_TIME,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: MUTATION_RETRY,
      },
    },
  });
}

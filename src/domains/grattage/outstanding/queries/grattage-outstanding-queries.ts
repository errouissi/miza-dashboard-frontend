import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchGrattageOutstanding } from "../api/grattage-outstanding-api";
import type {
  GrattageOutstanding,
  GrattageRestockGate,
} from "../model/grattage-outstanding";
import { grattageOutstandingKeys } from "./keys";

/**
 * Grattage Outstanding data hooks (FTA §8) — the second Grattage resource
 * (roadmap M6, Phase 2).
 *
 * `LIVE` TIER — `stale-times.ts`'s own docblock names "outstanding
 * grattage, restock-gate state" explicitly under this tier.
 *
 * `useGrattageOutstandingQuery` IS NOT EXPORTED FROM THIS MODULE'S
 * `index.ts` — deliberately private (M6 Phase 2 decision): no real caller
 * exists yet (both frozen documents place the actual "Outstanding &
 * Restock Gate" VIEW inside Agent 360, M7). Exporting it now would be
 * building a public surface ahead of the domain that uses it — the same
 * discipline `registry.ts`'s own "entries are added per resource, never
 * ahead of a caller" already applies elsewhere. Promote it to `index.ts`
 * when M7 has a real consumer, not before.
 */
export function useGrattageOutstandingQuery(
  agentId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: grattageOutstandingKeys.detail(agentId),
    queryFn: () => fetchGrattageOutstanding(agentId),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * THE ONE PUBLIC EXPORT OF THIS MODULE (M6 Phase 2) — the narrow
 * restock-gate hook the frozen architecture names as "the one intentional
 * domain→domain import in the app" (FTA §4, mechanism 2): Stock's
 * Allocation/Agent-Transfer forms will import this in Phase 3 and receive
 * ONLY `{blocked, reason}`, never this module's internals or its
 * `summary`/`invoices` business data.
 *
 * SHARES `useGrattageOutstandingQuery`'s EXACT CACHE KEY, via `select` —
 * NOT a second, independent fetch. One network call per agent per
 * staleness window serves both this hook and the private full read,
 * whichever mounts first; TanStack Query's `select` re-derives its own
 * return value from the shared cache entry without re-fetching (pinned by
 * this module's own test).
 */
export function useGrattageRestockGateQuery(
  agentId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: grattageOutstandingKeys.detail(agentId),
    queryFn: () => fetchGrattageOutstanding(agentId),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
    select: (data: GrattageOutstanding): GrattageRestockGate => data.restockGate,
  });
}

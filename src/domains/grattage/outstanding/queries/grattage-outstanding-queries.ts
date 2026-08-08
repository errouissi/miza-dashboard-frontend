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
 * PROMOTED TO PUBLIC (M7 Phase 3) — exported from this module's `index.ts`
 * now that Agent 360's `AgentOutstandingPanel` is a real caller (ADR-0026's
 * own anticipated consequence). Was private through M6 Phase 2, on the
 * "entries are added per resource, never ahead of a caller" discipline
 * `registry.ts` also applies.
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

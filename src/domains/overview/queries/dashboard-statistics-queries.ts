import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchDashboardStatistics } from "../api/dashboard-statistics-api";
import { dashboardStatisticsKeys } from "./keys";

/**
 * M7 Overview Phase 2 — Statistics. `SLOW` tier (5 min), approved
 * explicitly for this query: an aggregate KPI read, not a decision-gating
 * queue (`LIVE`) and not reference data (`STATIC`) — the same "an
 * annoyance, not a financial error" reasoning ADR-0007 already applies to
 * identity resources carrying an account status.
 *
 * `enabled` exists for the SAME reason Phase 1's three widgets each split
 * into an outer-gate + inner-content component: this query has no route
 * guard to sit inside (Overview composes it directly), so
 * `StatisticsPanel` conditionally MOUNTS its content component rather
 * than calling this hook unconditionally and gating after the fact.
 */
export function useDashboardStatisticsQuery(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: dashboardStatisticsKeys.all,
    queryFn: fetchDashboardStatistics,
    staleTime: STALE_TIMES.SLOW,
    enabled: options.enabled ?? true,
  });
}

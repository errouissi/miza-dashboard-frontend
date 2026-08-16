import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchDashboardChartData } from "../api/dashboard-chart-data-api";
import { dashboardChartDataKeys } from "./keys";

/**
 * M7 Overview Phase 3 — Trends. `SLOW` tier (5 min), same reasoning as
 * `useDashboardStatisticsQuery`: an aggregate trend read, not a
 * decision-gating queue. No `invalidation-map.ts` entry — no mutation in
 * the product writes deposits/agent registrations in a way this read
 * needs to react to instantly.
 *
 * `enabled` exists for the same outer-gate + inner-content reason every
 * Overview query already documents: this hook has no route guard to sit
 * inside, so `TrendsPanel` conditionally MOUNTS its content component
 * rather than gating after the hook already ran.
 */
export function useDashboardChartDataQuery(
  days = 30,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: dashboardChartDataKeys.detail(days),
    queryFn: () => fetchDashboardChartData(days),
    staleTime: STALE_TIMES.SLOW,
    enabled: options.enabled ?? true,
  });
}

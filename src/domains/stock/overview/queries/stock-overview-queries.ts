import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchStockOverview } from "../api/stock-overview-api";
import { stockOverviewKeys } from "./keys";

/**
 * `LIVE` tier (15s) — physical stock balances change as admins validate
 * allocations/transfers/returns/sales in real time; the same "multiple
 * admins act on the same balance concurrently" reasoning every other Stock
 * list query already applies (e.g. `useBonsQuery`). Not `CRITICAL`: no
 * irreversible confirmation reads through this query. Not `STATIC`/`SLOW`:
 * this is a live balance, not inert reference data or an identity record.
 *
 * No `enabled` option, unlike `useDashboardStatisticsQuery` — that query
 * has no route guard to sit inside (Overview composes it directly at `/`).
 * This query's own future page (Phase 2B) is a dedicated routed screen,
 * gated by `RequirePermission` at the route level — the same simpler shape
 * `useBonsQuery`/`useGrattageInvoicesQuery` already use.
 */
export function useStockOverviewQuery() {
  return useQuery({
    queryKey: stockOverviewKeys.all,
    queryFn: fetchStockOverview,
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

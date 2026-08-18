import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchStockMovements } from "../api/stock-movements-api";
import type { StockMovementListParams } from "../model/stock-movement";
import { stockMovementsKeys } from "./keys";

/**
 * `LIVE` tier, same reasoning as every other Stock list query
 * (`useBonsQuery`, `useStockOverviewQuery`): multiple admins may act on the
 * underlying balances concurrently, and this ledger is the audit trail of
 * exactly those actions.
 */
export function useStockMovementsQuery(params: StockMovementListParams) {
  return useQuery({
    queryKey: stockMovementsKeys.list(params),
    queryFn: () => fetchStockMovements(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

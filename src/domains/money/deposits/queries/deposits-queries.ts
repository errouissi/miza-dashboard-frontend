import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchDeposits } from "../api/deposits-api";
import type { DepositListParams } from "../model/deposit";
import { depositsKeys } from "./keys";

/**
 * The Deposits list (M4.3 Phase 1). `LIVE` tier, `refetchOnWindowFocus:
 * true` — same tier Cheques' own list/pending-queue/detail all use (FTA §8
 * names financial queues explicitly under this tier).
 */
export function useDepositsQuery(params: DepositListParams) {
  return useQuery({
    queryKey: depositsKeys.list(params),
    queryFn: () => fetchDeposits(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

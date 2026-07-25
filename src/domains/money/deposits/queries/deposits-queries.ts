import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchDeposits, fetchDepositById } from "../api/deposits-api";
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

/**
 * A single deposit (M4.3 Phase 2). Same `LIVE` tier as the list.
 *
 * `enabled` guards a malformed `:id` route param (a hand-edited URL) from
 * firing `GET /admin/depos/NaN` — the caller resolves `Number.isInteger`
 * itself and passes the result in, the same pattern `useChequeQuery`
 * already established.
 */
export function useDepositQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: depositsKeys.detail(id),
    queryFn: () => fetchDepositById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

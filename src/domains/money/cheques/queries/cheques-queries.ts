import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import { fetchCheques, fetchChequeById } from "../api/cheques-api";
import type { ChequeListParams } from "../model/cheque";
import { chequesKeys } from "./keys";

/**
 * Cheques data hooks (FTA §8). Phase 1 — read-only; no mutations yet.
 *
 * LIVE tier: FTA §8's own table names "pending cheques" explicitly under
 * this tier, and the plain (unfiltered) list is the same class of data —
 * multiple admins may act on any cheque's status concurrently, not only
 * ones already filtered to pending. `refetchOnWindowFocus: true` is LIVE's
 * own defined behavior — the one deliberate exception to the QueryClient's
 * product-wide default of `false` (`query-client.ts`).
 */
export function useChequesQuery(params: ChequeListParams) {
  return useQuery({
    queryKey: chequesKeys.list(params),
    queryFn: () => fetchCheques(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * A single cheque. Same LIVE tier as the list — this is a general-purpose
 * read, NOT the freshness rule's own CRITICAL, immediately-before-confirm
 * refetch (FTA §8). A future approve/reject/annuler confirmation dialog
 * must perform that as its own explicit, separately-tiered read when built,
 * not rely on this hook's cache.
 */
export function useChequeQuery(id: number) {
  return useQuery({
    queryKey: chequesKeys.detail(id),
    queryFn: () => fetchChequeById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

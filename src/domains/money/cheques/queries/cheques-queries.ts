import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import { createCheque, fetchCheques, fetchChequeById } from "../api/cheques-api";
import type { ChequeListParams } from "../model/cheque";
import type { CreateChequeFormValues } from "../model/create-cheque";
import { chequesKeys } from "./keys";

/**
 * Cheques data hooks (FTA §8). Phase 1 — read-only. Phase 3A adds the first
 * mutation, `useCreateChequeMutation`.
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

/**
 * Cheque creation (roadmap M4.2 Phase 3A) — `POST /admin/cheques`.
 *
 * THE FIRST REAL CALLER OF `invalidateForEvent` (D-3, the M4.1
 * `invalidation-map.ts` scaffold) in this product. Invalidates via the
 * `"cheque.created"` event rather than a local `queryClient.invalidateQueries({
 * queryKey: chequesKeys.all })` call, even though the two are equivalent
 * today — creating a cheque only ever adds a new, `en_attente` row; it does
 * not touch `agent.solde`/`montant_avance_*` the way approve/annuler will,
 * so nothing outside Cheques' own key space needs busting yet (unlike the
 * `cheque.approved`/`cheque.annuled` events `next-session.md` already plans
 * to also invalidate Network's Managers/Commercials prefixes). Going
 * through the event mechanism now, for a single-domain effect, is what
 * proves the mechanism itself before a cross-domain caller depends on it.
 *
 * No optimistic update, no automatic retry (FTA D-7, §11) — this is a
 * financial-record creation; a request that appears to succeed and then
 * silently reverts is worse than a slow one.
 */
export function useCreateChequeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateChequeFormValues) => createCheque(values),
    onSuccess: () => invalidateForEvent(queryClient, "cheque.created"),
  });
}

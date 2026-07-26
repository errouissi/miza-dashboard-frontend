import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  approveCheque,
  annulerCheque,
  createCheque,
  fetchCheques,
  fetchChequeById,
  fetchPendingCheques,
  rejectCheque,
} from "../api/cheques-api";
import type {
  ChequeAllocationType,
  ChequeListParams,
  PendingChequeListParams,
} from "../model/cheque";
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
 *
 * `enabled` (M4.2 Phase 3B) exists for `ChequeDetailPage`'s own guard: a
 * malformed `:id` route param (non-numeric, from a hand-edited URL) must
 * not fire `GET /admin/cheques/NaN` — the caller resolves `Number.isInteger`
 * itself and passes the result in, the same pattern
 * `useCommercialOptionsQuery({ enabled })` already established.
 */
export function useChequeQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: chequesKeys.detail(id),
    queryFn: () => fetchChequeById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * The freshness-rule read (M4 · G4 closure) — `useChequeQuery`'s own
 * docblock named this exact need ahead of time.
 *
 * ITS OWN KEY (`chequesKeys.freshness(id)`), DELIBERATELY NOT
 * `chequesKeys.detail(id)` — an earlier draft shared the detail key so a
 * successful refetch would transparently refresh the host page's own
 * display too, but that has a real bug: TanStack Query's error/success
 * state is tracked per QUERY KEY, shared across every observer of it, so a
 * TRANSIENT FAILURE of this pre-confirm check would flip `useChequeQuery`'s
 * own result into an error state as well — the whole detail page would
 * render "could not be loaded" over a dialog merely failing to re-verify.
 * Confirmed empirically before this hook shipped. A distinct key isolates
 * the check to whichever dialog is running it; the host page's own display
 * is untouched by either outcome. It still sits under the `["cheques"]`
 * prefix, so `cheque.approved`/`rejected`/`annuled` invalidations still
 * reach it — harmless, since it is `enabled: false` and unobserved once its
 * dialog closes.
 *
 * `staleTime: CRITICAL` documents the intent (this read must never be
 * treated as acceptable-if-recent); `enabled: false` means this observer
 * never fetches on its own — it exists to be driven by an explicit
 * `refetch()` call from `useFreshConfirm` the instant a confirm dialog
 * opens, which bypasses `staleTime` entirely regardless of the tier
 * configured. Declaring `enabled: false` here is what keeps that
 * deliberate; leaving it default-enabled would let this observer race an
 * automatic "stale on mount" fetch of its own, on top of the explicit one.
 */
export function useChequeFreshnessQuery(id: number) {
  return useQuery({
    queryKey: chequesKeys.freshness(id),
    queryFn: () => fetchChequeById(id),
    staleTime: STALE_TIMES.CRITICAL,
    enabled: false,
  });
}

/**
 * The pending queue (M4.2 Phase 3B) — `GET /admin/cheques/pending`. Same
 * `LIVE` tier as the general list: multiple admins may act on any pending
 * cheque concurrently (FTA §8 names "pending cheques" explicitly under this
 * tier), and `next-session.md`'s own plan for this phase confirms it.
 */
export function usePendingChequesQuery(params: PendingChequeListParams) {
  return useQuery({
    queryKey: chequesKeys.pendingList(params),
    queryFn: () => fetchPendingCheques(params),
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

/**
 * Approve (M4.2 Phase 3C, allocation split added same phase after a scope
 * correction) — `PUT /admin/cheques/{id}/approve`. Always sends a real
 * `allocations` array now: the caller (`ApproveChequeDialog`) builds it
 * from its own Rapped/Grattage inputs, omitting whichever side is zero
 * (the backend's `min:0.01` per-entry rule rejects a zero-value entry
 * outright). UNCHANGED otherwise: same mutation, same invalidation — only
 * the payload changed.
 *
 * Invalidates via `"cheque.approved"`, registered in `invalidation-map.ts`
 * to also bust Managers'/Commercials' own key spaces — approval writes
 * `agent.montant_avance_rapped`/`montant_avance_grattage`/`solde`, the
 * same columns those lists render as `avanceTotal`.
 *
 * No optimistic update, no automatic retry (FTA D-7, §11) — same financial-
 * workflow discipline as `useCreateChequeMutation`.
 */
export function useApproveChequeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      allocations,
    }: {
      id: number;
      allocations: { type: ChequeAllocationType; amount: number }[];
    }) => approveCheque(id, allocations),
    onSuccess: () => invalidateForEvent(queryClient, "cheque.approved"),
  });
}

/**
 * Reject (M4.2 Phase 3C) — `PUT /admin/cheques/{id}/reject`. Requires
 * `decision_reason` (`required|string|max:1000` server-side); the caller
 * (`RejectChequeDialog`) collects it.
 *
 * Invalidates via `"cheque.rejected"` — Cheques' own key space only.
 * Rejecting touches no balance column (verified from source), so no
 * Network prefix is invalidated.
 */
export function useRejectChequeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisionReason }: { id: number; decisionReason: string }) =>
      rejectCheque(id, decisionReason),
    onSuccess: () => invalidateForEvent(queryClient, "cheque.rejected"),
  });
}

/**
 * Annuler (M4.2 Phase 3C) — `PUT /admin/cheques/{id}/annuler`. Approved-only
 * server-side; also requires `decision_reason`. Reverses the same balance
 * columns `approve` wrote, so invalidates via `"cheque.annuled"` — the same
 * two Network prefixes as `cheque.approved`.
 */
export function useAnnulerChequeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisionReason }: { id: number; decisionReason: string }) =>
      annulerCheque(id, decisionReason),
    onSuccess: () => invalidateForEvent(queryClient, "cheque.annuled"),
  });
}

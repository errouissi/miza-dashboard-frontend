import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  addBonLine,
  cancelBon,
  createBon,
  fetchBonById,
  fetchBons,
  removeBonLine,
  updateBonLine,
  validateBon,
} from "../api/bons-api";
import type { BonListParams } from "../model/bon";
import type { CreateBonFormValues } from "../model/create-bon";
import { bonsKeys } from "./keys";

/**
 * Bons data hooks (FTA §8) — the fifth and final Stock resource.
 *
 * `LIVE` TIER, same reasoning FTA §8 already gives every other Stock
 * resource: multiple admins may act on the same draft concurrently, and
 * this is exactly the class of data the freshness rule (FTA §8, M4's G4)
 * exists to protect once an irreversible action (Validate OR Cancel) is
 * in view.
 */
export function useBonsQuery(params: BonListParams) {
  return useQuery({
    queryKey: bonsKeys.list(params),
    queryFn: () => fetchBons(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * A single bon. Same `LIVE` tier as the list. `enabled` guards a
 * malformed `:id` route param, the same pattern every prior Stock detail
 * query already established.
 */
export function useBonQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: bonsKeys.detail(id),
    queryFn: () => fetchBonById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * The freshness-rule read, SHARED by `ValidateBonDialog` and
 * `CancelBonDialog` (see `bonsKeys.freshness`'s own docblock for why one
 * query correctly serves both). `enabled: false` — this observer never
 * fetches on its own; `useFreshConfirm` drives it via an explicit
 * `refetch()` the instant either dialog opens.
 */
export function useBonFreshnessQuery(id: number) {
  return useQuery({
    queryKey: bonsKeys.freshness(id),
    queryFn: () => fetchBonById(id),
    staleTime: STALE_TIMES.CRITICAL,
    enabled: false,
  });
}

/**
 * Create (header only, multipart — see `model/create-bon.ts`'s own
 * docblock). Invalidates via `"bon.created"` — `["bons"]` only; no
 * cross-domain effect exists yet (a draft touches no stock row —
 * materialization only happens at validate time).
 */
export function useCreateBonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateBonFormValues) => createBon(values),
    onSuccess: () => invalidateForEvent(queryClient, "bon.created"),
  });
}

/**
 * The three line mutations all invalidate via the SAME
 * `"bon.line-changed"` event. No optimistic update (FTA D-7):
 * `removeBonLine` in particular returns no body at all (204), so
 * invalidate-and-refetch is not merely this codebase's usual discipline
 * here — it is the ONLY way the UI learns the line is gone.
 */
export function useAddBonLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bonId,
      values,
    }: {
      bonId: number;
      values: { productId: number; quantity: number; unitCost: string; notes: string };
    }) => addBonLine(bonId, values),
    onSuccess: () => invalidateForEvent(queryClient, "bon.line-changed"),
  });
}

export function useUpdateBonLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      bonId,
      lineId,
      values,
    }: {
      bonId: number;
      lineId: number;
      values: { quantity: number; unitCost: string; notes: string };
    }) => updateBonLine(bonId, lineId, values),
    onSuccess: () => invalidateForEvent(queryClient, "bon.line-changed"),
  });
}

export function useRemoveBonLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bonId, lineId }: { bonId: number; lineId: number }) =>
      removeBonLine(bonId, lineId),
    onSuccess: () => invalidateForEvent(queryClient, "bon.line-changed"),
  });
}

/**
 * Validate — `POST /admin/bons/{id}/validate`. Irreversible (FTA D-7,
 * §11): no optimistic update, no automatic retry. Invalidates via
 * `"bon.validated"` — `["bons"]` only (re-verified from source this
 * phase, `StockService::validateBon` writes only `stock_movements`/
 * `stocks` rows, never a column any Network list renders).
 */
export function useValidateBonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => validateBon(id),
    onSuccess: () => invalidateForEvent(queryClient, "bon.validated"),
  });
}

/**
 * Cancel — `POST /admin/bons/{id}/cancel`, `{cancellation_reason}`.
 * Irreversible, super-admin only. Invalidates via `"bon.cancelled"` —
 * `["bons"]` only (re-verified from source, `StockService::cancelBon`
 * writes only `stock_movements`/`stocks` rows plus the bon's own four
 * cancellation-audit columns).
 */
export function useCancelBonMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => cancelBon(id, reason),
    onSuccess: () => invalidateForEvent(queryClient, "bon.cancelled"),
  });
}

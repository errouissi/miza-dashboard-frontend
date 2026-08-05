import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  addAllocationLine,
  createAllocation,
  fetchAllocationById,
  fetchAllocations,
  removeAllocationLine,
  updateAllocationLine,
  validateAllocation,
} from "../api/allocations-api";
import { fetchCompanyStock } from "../api/company-stock-api";
import type { AllocationListParams } from "../model/allocation";
import type { CreateAllocationFormValues } from "../model/create-allocation";
import { allocationsKeys } from "./keys";

/**
 * Allocations data hooks (FTA §8) — the fourth Stock resource.
 *
 * `LIVE` TIER, same reasoning FTA §8 already gives Money's own queues and
 * both prior Stock resources: multiple admins may act on the same draft
 * (adding lines, validating) concurrently, and this is exactly the class of
 * data the freshness rule (FTA §8, closed at M4's G4) exists to protect
 * once an irreversible action is in view.
 */
export function useAllocationsQuery(params: AllocationListParams) {
  return useQuery({
    queryKey: allocationsKeys.list(params),
    queryFn: () => fetchAllocations(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * A single allocation. Same `LIVE` tier as the list. `enabled` guards a
 * malformed `:id` route param, the same pattern Return's/Transfer's own
 * detail query already established.
 */
export function useAllocationQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: allocationsKeys.detail(id),
    queryFn: () => fetchAllocationById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * The freshness-rule read (M4 · G4 closure precedent, reused here exactly
 * as Return's/Transfer's own) — its OWN cache key
 * (`allocationsKeys.freshness`), deliberately distinct from `detail(id)`.
 * `enabled: false` — this observer never fetches on its own;
 * `useFreshConfirm` drives it via an explicit `refetch()` the instant the
 * validate dialog opens, which bypasses `staleTime` regardless of the tier
 * configured.
 */
export function useAllocationFreshnessQuery(id: number) {
  return useQuery({
    queryKey: allocationsKeys.freshness(id),
    queryFn: () => fetchAllocationById(id),
    staleTime: STALE_TIMES.CRITICAL,
    enabled: false,
  });
}

/**
 * The detail page's own "add line" product picker
 * (`GET /admin/companies/{company}/stock`) — THE backend source of truth
 * for product availability, verified fresh from source
 * (`CompanyController::stock`). `LIVE` tier: the same class of data as the
 * allocation itself, and it can change the instant another admin validates
 * a different allocation against the same company. Replaces the generic,
 * unfiltered `useProductOptionsQuery()` this page used before this
 * contract existed — every option this query returns already has
 * `available_quantity > 0`, so the picker can never offer a product with
 * no stock to allocate.
 */
export function useCompanyStockQuery(
  companyId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: allocationsKeys.companyStock(companyId),
    queryFn: () => fetchCompanyStock(companyId),
    staleTime: STALE_TIMES.LIVE,
    enabled: (options.enabled ?? true) && companyId > 0,
  });
}

/**
 * Create (header only — see `model/create-allocation.ts`'s own docblock for
 * why lines are not part of this submission). Invalidates via
 * `"allocation.created"` — `["allocations"]` only; no cross-domain effect
 * exists yet (a draft touches no balance, no stock row, no deposit —
 * materialization and deposit consumption both happen only at validate
 * time).
 */
export function useCreateAllocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateAllocationFormValues) => createAllocation(values),
    onSuccess: () => invalidateForEvent(queryClient, "allocation.created"),
  });
}

/**
 * The three line mutations all invalidate via the SAME
 * `"allocation.line-changed"` event — each one changes the same resource's
 * own key space (the list may render `montant`, recomputed on every line
 * write) and none has a distinct cross-domain effect from the others. No
 * optimistic update (FTA D-7): each mutation's own response already carries
 * the refreshed parent, but this codebase's established discipline is
 * invalidate-and-refetch, not a manual cache write from a mutation's
 * response — re-applied here, not a new decision.
 */
export function useAddAllocationLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      allocationId,
      values,
    }: {
      allocationId: number;
      values: { productId: number; quantity: number; unitCost: string; notes: string };
    }) => addAllocationLine(allocationId, values),
    onSuccess: () => invalidateForEvent(queryClient, "allocation.line-changed"),
  });
}

export function useUpdateAllocationLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      allocationId,
      lineId,
      values,
    }: {
      allocationId: number;
      lineId: number;
      values: { quantity: number; unitCost: string; notes: string };
    }) => updateAllocationLine(allocationId, lineId, values),
    onSuccess: () => invalidateForEvent(queryClient, "allocation.line-changed"),
  });
}

export function useRemoveAllocationLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ allocationId, lineId }: { allocationId: number; lineId: number }) =>
      removeAllocationLine(allocationId, lineId),
    onSuccess: () => invalidateForEvent(queryClient, "allocation.line-changed"),
  });
}

/**
 * Validate — `POST /admin/allocations/{id}/validate`. Irreversible
 * (FTA D-7, §11): no optimistic update, no automatic retry. Invalidates via
 * `"allocation.validated"` — `["allocations"]` only (re-verified from
 * source this phase, `StockService::validateAllocation` writes
 * `stocks`/`stock_movements`/`allocation_deposit_consumptions` rows, and
 * reads but never WRITES `Agent.montant_avance_grattage` — no Network list
 * renders a column this mutation changes, and Deposits' own `amount`/
 * `status` columns are untouched too, ADC being a separate audit table).
 * Revisit once a Stock ledger view or the Grattage restock-gate hook
 * (both M6) exist.
 */
export function useValidateAllocationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => validateAllocation(id),
    onSuccess: () => invalidateForEvent(queryClient, "allocation.validated"),
  });
}

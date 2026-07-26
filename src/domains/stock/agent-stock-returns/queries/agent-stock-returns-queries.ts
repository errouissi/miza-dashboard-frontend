import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  addAgentStockReturnLine,
  createAgentStockReturn,
  fetchAgentStockReturnById,
  fetchAgentStockReturns,
  removeAgentStockReturnLine,
  updateAgentStockReturnLine,
  validateAgentStockReturn,
} from "../api/agent-stock-returns-api";
import { fetchManagerCommercials } from "../api/agent-sub-data-api";
import type { AgentStockReturnListParams } from "../model/agent-stock-return";
import type { CreateAgentStockReturnFormValues } from "../model/create-agent-stock-return";
import { agentStockReturnsKeys } from "./keys";

/**
 * Agent Stock Returns data hooks (FTA §8) — the first Stock resource.
 *
 * `LIVE` TIER, same reasoning FTA §8 already gives Money's own queues:
 * multiple admins may act on the same draft (adding lines, validating)
 * concurrently, and this is exactly the class of data the freshness rule
 * (FTA §8, closed at M4's G4) exists to protect once an irreversible action
 * is in view.
 */
export function useAgentStockReturnsQuery(params: AgentStockReturnListParams) {
  return useQuery({
    queryKey: agentStockReturnsKeys.list(params),
    queryFn: () => fetchAgentStockReturns(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * A single return. Same `LIVE` tier as the list. `enabled` guards a
 * malformed `:id` route param, the same pattern `useChequeQuery` already
 * established.
 */
export function useAgentStockReturnQuery(
  id: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: agentStockReturnsKeys.detail(id),
    queryFn: () => fetchAgentStockReturnById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * The freshness-rule read (M4 · G4 closure precedent, roadmap M5 Phase 1's
 * first reuse of it) — its OWN cache key
 * (`agentStockReturnsKeys.freshness`), deliberately distinct from
 * `detail(id)`. See `chequesKeys.freshness`'s own docblock for why: a
 * shared key would let a transient verification failure flip the host
 * page's own detail query into an error state too. `enabled: false` — this
 * observer never fetches on its own; `useFreshConfirm` drives it via an
 * explicit `refetch()` the instant the validate dialog opens, which
 * bypasses `staleTime` regardless of the tier configured.
 */
export function useAgentStockReturnFreshnessQuery(id: number) {
  return useQuery({
    queryKey: agentStockReturnsKeys.freshness(id),
    queryFn: () => fetchAgentStockReturnById(id),
    staleTime: STALE_TIMES.CRITICAL,
    enabled: false,
  });
}

/**
 * The Create form's manager-scoped commercial picker
 * (`ReturnManagerCommercialField`'s own read) — `LIVE` tier: a commercial's
 * manager assignment or status can change between page load and submit,
 * and this picker's whole reason to exist is guaranteeing the binding is
 * still correct at the moment of choice. `enabled` gates on a manager
 * actually being selected — no manager, no request.
 */
export function useManagerCommercialsQuery(
  managerId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: agentStockReturnsKeys.managerCommercials(managerId),
    queryFn: () => fetchManagerCommercials(managerId),
    staleTime: STALE_TIMES.LIVE,
    enabled: (options.enabled ?? true) && !!managerId,
  });
}

/**
 * Create (header only — see `model/create-agent-stock-return.ts`'s own
 * docblock for why lines are not part of this submission). Invalidates via
 * `"agent-stock-return.created"` — `["agent-stock-returns"]` only; no
 * cross-domain effect exists yet (a draft touches no balance, no stock
 * row — materialization happens only at validate time).
 */
export function useCreateAgentStockReturnMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateAgentStockReturnFormValues) =>
      createAgentStockReturn(values),
    onSuccess: () => invalidateForEvent(queryClient, "agent-stock-return.created"),
  });
}

/**
 * The three line mutations all invalidate via the SAME
 * `"agent-stock-return.line-changed"` event — each one changes the same
 * resource's own key space (the list may render `montant`, recomputed on
 * every line write) and none has a distinct cross-domain effect from the
 * others. No optimistic update (FTA D-7): each mutation's own response
 * already carries the refreshed parent, but this codebase's established
 * discipline is invalidate-and-refetch, not a manual cache write from a
 * mutation's response (`useValidateDepositMutation` and every sibling
 * mutation in this app follow the same rule) — re-applied here, not a new
 * decision.
 */
export function useAddAgentStockReturnLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      returnId,
      values,
    }: {
      returnId: number;
      values: { productId: number; quantity: number; unitCost: string; notes: string };
    }) => addAgentStockReturnLine(returnId, values),
    onSuccess: () => invalidateForEvent(queryClient, "agent-stock-return.line-changed"),
  });
}

export function useUpdateAgentStockReturnLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      returnId,
      lineId,
      values,
    }: {
      returnId: number;
      lineId: number;
      values: { quantity: number; unitCost: string; notes: string };
    }) => updateAgentStockReturnLine(returnId, lineId, values),
    onSuccess: () => invalidateForEvent(queryClient, "agent-stock-return.line-changed"),
  });
}

export function useRemoveAgentStockReturnLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ returnId, lineId }: { returnId: number; lineId: number }) =>
      removeAgentStockReturnLine(returnId, lineId),
    onSuccess: () => invalidateForEvent(queryClient, "agent-stock-return.line-changed"),
  });
}

/**
 * Validate — `POST /admin/agent-stock-returns/{id}/validate`. Irreversible
 * (FTA D-7, §11): no optimistic update, no automatic retry. Invalidates via
 * `"agent-stock-return.validated"` — `["agent-stock-returns"]` only today;
 * no frontend query yet reads the stock-quantity effect this materializes
 * (no `StockController`, no consumer anywhere — verified from source this
 * phase), so there is no cross-domain prefix to add. Revisit once a Stock
 * ledger view or the Grattage restock-gate hook (both M6) exist.
 */
export function useValidateAgentStockReturnMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => validateAgentStockReturn(id),
    onSuccess: () => invalidateForEvent(queryClient, "agent-stock-return.validated"),
  });
}

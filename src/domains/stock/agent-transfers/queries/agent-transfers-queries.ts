import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  addAgentTransferLine,
  createAgentTransfer,
  fetchAgentTransferById,
  fetchAgentTransfers,
  removeAgentTransferLine,
  updateAgentTransferLine,
  validateAgentTransfer,
} from "../api/agent-transfers-api";
import { fetchManagerCommercials } from "../api/agent-sub-data-api";
import type { AgentTransferListParams } from "../model/agent-transfer";
import type { CreateAgentTransferFormValues } from "../model/create-agent-transfer";
import { agentTransfersKeys } from "./keys";

/**
 * Agent Transfers data hooks (FTA §8) — the second Stock resource.
 *
 * `LIVE` TIER, same reasoning FTA §8 already gives Money's own queues and
 * Return's own Stock queue: multiple admins may act on the same draft
 * (adding lines, validating) concurrently, and this is exactly the class of
 * data the freshness rule (FTA §8, closed at M4's G4) exists to protect
 * once an irreversible action is in view.
 */
export function useAgentTransfersQuery(params: AgentTransferListParams) {
  return useQuery({
    queryKey: agentTransfersKeys.list(params),
    queryFn: () => fetchAgentTransfers(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * A single transfer. Same `LIVE` tier as the list. `enabled` guards a
 * malformed `:id` route param, the same pattern Return's own detail query
 * already established.
 */
export function useAgentTransferQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: agentTransfersKeys.detail(id),
    queryFn: () => fetchAgentTransferById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * The freshness-rule read (M4 · G4 closure precedent, reused here exactly
 * as Return's own) — its OWN cache key (`agentTransfersKeys.freshness`),
 * deliberately distinct from `detail(id)`. See `chequesKeys.freshness`'s own
 * docblock for why: a shared key would let a transient verification failure
 * flip the host page's own detail query into an error state too.
 * `enabled: false` — this observer never fetches on its own;
 * `useFreshConfirm` drives it via an explicit `refetch()` the instant the
 * validate dialog opens, which bypasses `staleTime` regardless of the tier
 * configured.
 */
export function useAgentTransferFreshnessQuery(id: number) {
  return useQuery({
    queryKey: agentTransfersKeys.freshness(id),
    queryFn: () => fetchAgentTransferById(id),
    staleTime: STALE_TIMES.CRITICAL,
    enabled: false,
  });
}

/**
 * The Create form's manager-scoped commercial picker
 * (`TransferManagerCommercialField`'s own read) — `LIVE` tier: a
 * commercial's manager assignment or status can change between page load
 * and submit, and this picker's whole reason to exist is guaranteeing the
 * binding is still correct at the moment of choice. `enabled` gates on a
 * manager actually being selected — no manager, no request.
 */
export function useManagerCommercialsQuery(
  managerId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: agentTransfersKeys.managerCommercials(managerId),
    queryFn: () => fetchManagerCommercials(managerId),
    staleTime: STALE_TIMES.LIVE,
    enabled: (options.enabled ?? true) && !!managerId,
  });
}

/**
 * Create (header only — see `model/create-agent-transfer.ts`'s own
 * docblock for why lines are not part of this submission). Invalidates via
 * `"agent-transfer.created"` — `["agent-transfers"]` only; no cross-domain
 * effect exists yet (a draft touches no balance, no stock row —
 * materialization happens only at validate time).
 */
export function useCreateAgentTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateAgentTransferFormValues) => createAgentTransfer(values),
    onSuccess: () => invalidateForEvent(queryClient, "agent-transfer.created"),
  });
}

/**
 * The three line mutations all invalidate via the SAME
 * `"agent-transfer.line-changed"` event — each one changes the same
 * resource's own key space (the list may render `montant`, recomputed on
 * every line write) and none has a distinct cross-domain effect from the
 * others. No optimistic update (FTA D-7): each mutation's own response
 * already carries the refreshed parent, but this codebase's established
 * discipline is invalidate-and-refetch, not a manual cache write from a
 * mutation's response — re-applied here, not a new decision.
 */
export function useAddAgentTransferLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      transferId,
      values,
    }: {
      transferId: number;
      values: { productId: number; quantity: number; unitCost: string; notes: string };
    }) => addAgentTransferLine(transferId, values),
    onSuccess: () => invalidateForEvent(queryClient, "agent-transfer.line-changed"),
  });
}

export function useUpdateAgentTransferLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      transferId,
      lineId,
      values,
    }: {
      transferId: number;
      lineId: number;
      values: { quantity: number; unitCost: string; notes: string };
    }) => updateAgentTransferLine(transferId, lineId, values),
    onSuccess: () => invalidateForEvent(queryClient, "agent-transfer.line-changed"),
  });
}

export function useRemoveAgentTransferLineMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transferId, lineId }: { transferId: number; lineId: number }) =>
      removeAgentTransferLine(transferId, lineId),
    onSuccess: () => invalidateForEvent(queryClient, "agent-transfer.line-changed"),
  });
}

/**
 * Validate — `POST /admin/agent-transfers/{id}/validate`. Irreversible
 * (FTA D-7, §11): no optimistic update, no automatic retry. Invalidates via
 * `"agent-transfer.validated"` — `["agent-transfers"]` only today (re-
 * verified from source this phase, `StockService::validateTransfer` Step 8
 * writes only `stocks`/`stock_movements` rows, never an `Agent` balance
 * column any Network list renders). Revisit once a Stock ledger view or the
 * Grattage restock-gate hook (both M6) exist.
 */
export function useValidateAgentTransferMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => validateAgentTransfer(id),
    onSuccess: () => invalidateForEvent(queryClient, "agent-transfer.validated"),
  });
}

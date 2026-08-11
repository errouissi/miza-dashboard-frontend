import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  assignClientsBulk,
  fetchClientById,
  fetchClients,
  toggleClientStatus,
  updateClient,
  type AssignClientsBulkInput,
  type UpdateClientInput,
} from "../api/clients-api";
import type { ClientListParams } from "../model/client";
import { clientsKeys } from "./keys";

/**
 * Clients data hooks (FTA §8).
 *
 * SLOW tier, per ADR-0007 — clients are already named explicitly there
 * ("agent and client lists"), so no new cache-tier decision is needed.
 */
export function useClientsQuery(params: ClientListParams) {
  return useQuery({
    queryKey: clientsKeys.list(params),
    queryFn: () => fetchClients(params),
    staleTime: STALE_TIMES.SLOW,
  });
}

/**
 * Client 360 (M7 Phase 1) — mirrors `useAgentQuery`'s own shape exactly
 * (`domains/network/agents/queries/agents-queries.ts`): SLOW tier (identity
 * data, same as the list above — `stale-times.ts`'s own docblock names
 * "agent and client lists AND DETAILS" explicitly under this tier), `enabled`
 * guards a malformed `:id` route param so no request ever fires for one.
 */
export function useClientQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: clientsKeys.detail(id),
    queryFn: () => fetchClientById(id),
    staleTime: STALE_TIMES.SLOW,
    enabled: options.enabled ?? true,
  });
}

/**
 * Every mutation reshapes the list, so all of them invalidate the LIST
 * space. `lists()`, not `all` — this domain exports no picker of its own, so
 * there is no sibling key space to keep in sync. No optimistic updates and
 * no automatic retries (FTA D-7, §11): a status change that appears to
 * succeed and then silently reverts is worse than a slow one.
 */
function useInvalidateClients() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: clientsKeys.lists() });
}

/**
 * Client 360 (M7 Phase 1) — a SEPARATE, TARGETED invalidation from the list
 * one above: only the mutations that can actually change a field
 * `ClientDetail` carries call this, and only for the exact id(s) affected
 * (never a speculative broad invalidation of every open detail cache).
 */
function useInvalidateClientDetail() {
  const queryClient = useQueryClient();
  return (id: number) =>
    queryClient.invalidateQueries({ queryKey: clientsKeys.detail(id) });
}

/**
 * `phone`/`ville`/`secteur` are all represented on `ClientDetail` — every
 * successful edit invalidates both the list AND this client's own detail.
 */
export function useUpdateClientMutation() {
  const invalidateList = useInvalidateClients();
  const invalidateDetail = useInvalidateClientDetail();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateClientInput & { id: number }) =>
      updateClient(id, input),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateDetail(variables.id);
    },
  });
}

/**
 * The single status-toggle mutation — there is no separate block/activate
 * pair for clients (see `api/clients-api.ts`). One mutation, used by one
 * dialog whose copy is computed from the client's CURRENT status.
 * `status` is on `ClientDetail`, so this also invalidates the client's own
 * detail (M7 Phase 1) — the workspace's status badge/action must reflect a
 * toggle made from either surface (list row or workspace).
 */
export function useToggleClientStatusMutation() {
  const invalidateList = useInvalidateClients();
  const invalidateDetail = useInvalidateClientDetail();
  return useMutation({
    mutationFn: (id: number) => toggleClientStatus(id),
    onSuccess: (_data, id) => {
      invalidateList();
      invalidateDetail(id);
    },
  });
}

/**
 * The M3.5 bulk-assign mutation. Invalidates the same LIST space as every
 * other Clients mutation — this domain owns no sibling key space of its own
 * (unlike Commercials, which now does), so `lists()` is the whole story
 * there. Selection-clearing on success is the CALLER's job (the list page
 * owns the selection state, not this hook) — see `client-bulk-assign-sheet.tsx`.
 *
 * ALSO INVALIDATES EACH TARGETED CLIENT'S OWN DETAIL (M7 Phase 1): the
 * current Commercial reference (`ClientDetail.commercial`) changes for every
 * id in `clientIds`, even though Client 360's own relationship panel isn't
 * built until Phase 2 — an operator who bulk-assigns and then opens Client
 * 360 for one of those clients must see the new relationship, not a stale
 * cache from before the assignment. Targeted per id, not a broad
 * `clientsKeys.all` invalidation.
 */
export function useAssignClientsBulkMutation() {
  const invalidateList = useInvalidateClients();
  const invalidateDetail = useInvalidateClientDetail();
  return useMutation({
    mutationFn: (input: AssignClientsBulkInput) => assignClientsBulk(input),
    onSuccess: (_data, variables) => {
      invalidateList();
      variables.clientIds.forEach(invalidateDetail);
    },
  });
}

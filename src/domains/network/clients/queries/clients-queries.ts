import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  assignClientsBulk,
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
 * Every mutation reshapes the list, so both invalidate the LIST space.
 * `lists()`, not `all` — this domain exports no picker of its own, so there
 * is no sibling key space to keep in sync. No optimistic updates and no
 * automatic retries (FTA D-7, §11): a status change that appears to succeed
 * and then silently reverts is worse than a slow one.
 */
function useInvalidateClients() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: clientsKeys.lists() });
}

export function useUpdateClientMutation() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateClientInput & { id: number }) =>
      updateClient(id, input),
    onSuccess: invalidate,
  });
}

/**
 * The single status-toggle mutation — there is no separate block/activate
 * pair for clients (see `api/clients-api.ts`). One mutation, used by one
 * dialog whose copy is computed from the client's CURRENT status.
 */
export function useToggleClientStatusMutation() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (id: number) => toggleClientStatus(id),
    onSuccess: invalidate,
  });
}

/**
 * The M3.5 bulk-assign mutation. Invalidates the same LIST space as every
 * other Clients mutation — this domain owns no sibling key space of its own
 * (unlike Commercials, which now does), so `lists()` is the whole story.
 * Selection-clearing on success is the CALLER's job (the list page owns the
 * selection state, not this hook) — see `client-bulk-assign-sheet.tsx`.
 */
export function useAssignClientsBulkMutation() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (input: AssignClientsBulkInput) => assignClientsBulk(input),
    onSuccess: invalidate,
  });
}

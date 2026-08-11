import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES } from "@/infrastructure/query";
import {
  assignClientsBulk,
  fetchClientAssignmentHistory,
  fetchClientById,
  fetchClients,
  reassignClient,
  toggleClientStatus,
  updateClient,
  type AssignClientsBulkInput,
  type UpdateClientInput,
} from "../api/clients-api";
import {
  CLIENT_ASSIGNMENT_HISTORY_PAGE_SIZE,
  type ClientListParams,
  type ReassignClientInput,
} from "../model/client";
import { clientAssignmentHistoryKeys, clientsKeys } from "./keys";

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
 * Client 360 Phase 2 — a THIRD, independently-targeted invalidation
 * (separate key space, see `clientAssignmentHistoryKeys`'s own docblock).
 * Invalidates every page cached for this client (`details(clientId)`, the
 * whole prefix), not only the first page this app currently fetches — a
 * future page-2 caller must not read stale data either.
 */
function useInvalidateClientAssignmentHistory() {
  const queryClient = useQueryClient();
  return (clientId: number) =>
    queryClient.invalidateQueries({
      queryKey: clientAssignmentHistoryKeys.details(clientId),
    });
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
 * id in `clientIds`. Targeted per id, not a broad `clientsKeys.all`
 * invalidation.
 *
 * ALSO INVALIDATES EACH TARGETED CLIENT'S OWN ASSIGNMENT HISTORY (M7 Phase
 * 2) — re-verified fresh from source this phase, not assumed: backend
 * commit `7066ffa` routed `ClientController::assignBulk` through
 * `ClientAssignmentService::assignBulk()`, which now writes one history row
 * per Client whose `agent_id` actually changed. This mutation existed
 * BEFORE `7066ffa` and did not previously affect any frontend-visible
 * read of history (the panel did not exist); it now does, so the
 * invalidation is added here, not left stale.
 */
export function useAssignClientsBulkMutation() {
  const invalidateList = useInvalidateClients();
  const invalidateDetail = useInvalidateClientDetail();
  const invalidateHistory = useInvalidateClientAssignmentHistory();
  return useMutation({
    mutationFn: (input: AssignClientsBulkInput) => assignClientsBulk(input),
    onSuccess: (_data, variables) => {
      invalidateList();
      variables.clientIds.forEach((id) => {
        invalidateDetail(id);
        invalidateHistory(id);
      });
    },
  });
}

/**
 * Client 360 Phase 2's own single-Client ownership action —
 * `PATCH /admin/clients/{id}/assign` (`reassignClient`, NOT the legacy
 * `POST` endpoint; see `api/clients-api.ts`'s own docblock). Invalidates
 * ALL THREE spaces the Phase 2 discovery plan named: the list (the row's
 * own "Agent" column, and `assigned`-filter membership), this Client's own
 * detail (the new current Commercial, read by the workspace's relationship
 * section), and this Client's own assignment history (the new row the
 * mutation just caused the backend to write, transactionally, alongside
 * the `agent_id` update).
 *
 * The SAME-TARGET no-op check (skip the request entirely when the
 * selection is unchanged) is the CALLER's responsibility, not this hook's
 * — see `client-reassign-drawer.tsx`'s own docblock for why that belongs
 * at the UI layer, where the CURRENT Commercial is already in hand.
 */
export function useReassignClientMutation() {
  const invalidateList = useInvalidateClients();
  const invalidateDetail = useInvalidateClientDetail();
  const invalidateHistory = useInvalidateClientAssignmentHistory();
  return useMutation({
    mutationFn: ({ id, ...input }: ReassignClientInput & { id: number }) =>
      reassignClient(id, input),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateDetail(variables.id);
      invalidateHistory(variables.id);
    },
  });
}

/**
 * Client 360 Phase 2 — the assignment-history panel's own read. SLOW tier,
 * the same as the detail query it sits beside (append-only audit data,
 * still identity-adjacent — no established "audit log" tier exists
 * elsewhere in this codebase to diverge toward). `enabled` guards a
 * malformed `:id`, mirroring `useClientQuery`'s own gate — the panel's OWN
 * `VIEW_CLIENTS` permission check is the caller's job (composed into
 * `enabled` at the call site), the identical discipline every other
 * permission-gated query in this domain already follows
 * (`useVilleOptionsQuery({ enabled })` inside `ClientFormSheet`, etc.).
 */
export function useClientAssignmentHistoryQuery(
  clientId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: clientAssignmentHistoryKeys.detail(clientId, 1),
    queryFn: () =>
      fetchClientAssignmentHistory(clientId, 1, CLIENT_ASSIGNMENT_HISTORY_PAGE_SIZE),
    staleTime: STALE_TIMES.SLOW,
    enabled: options.enabled ?? true,
  });
}

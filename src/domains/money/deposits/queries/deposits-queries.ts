import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  createDeposit,
  fetchAgentCash,
  fetchDeposits,
  fetchDepositById,
  fetchGrattageOutstanding,
  fetchLinkedGrattageInvoices,
  validateDeposit,
  rejectDeposit,
} from "../api/deposits-api";
import type { DepositListParams } from "../model/deposit";
import type { CreateDepositFormValues } from "../model/create-deposit";
import { depositsKeys } from "./keys";

/**
 * The Deposits list (M4.3 Phase 1). `LIVE` tier, `refetchOnWindowFocus:
 * true` — same tier Cheques' own list/pending-queue/detail all use (FTA §8
 * names financial queues explicitly under this tier).
 */
export function useDepositsQuery(params: DepositListParams) {
  return useQuery({
    queryKey: depositsKeys.list(params),
    queryFn: () => fetchDeposits(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * A single deposit (M4.3 Phase 2). Same `LIVE` tier as the list.
 *
 * `enabled` guards a malformed `:id` route param (a hand-edited URL) from
 * firing `GET /admin/depos/NaN` — the caller resolves `Number.isInteger`
 * itself and passes the result in, the same pattern `useChequeQuery`
 * already established.
 */
export function useDepositQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: depositsKeys.detail(id),
    queryFn: () => fetchDepositById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * The freshness-rule read (M4 · G4 closure) — ITS OWN KEY
 * (`depositsKeys.freshness(id)`), deliberately NOT the same key as
 * `useDepositQuery`. See `chequesKeys.freshness`'s own docblock (and
 * `useChequeFreshnessQuery`'s) for the reasoning, confirmed empirically
 * during implementation: sharing the detail key would mean a TRANSIENT
 * failure of this pre-confirm check flips the host page's own
 * `useDepositQuery` into an error state too. `enabled: false` — this
 * observer never fetches on its own; it exists to be driven by
 * `useFreshConfirm`'s explicit `refetch()` call the instant Validate/Reject
 * opens, which bypasses `staleTime` regardless of tier. `staleTime:
 * CRITICAL` still documents the intent (this read is never
 * acceptable-if-recent).
 */
export function useDepositFreshnessQuery(id: number) {
  return useQuery({
    queryKey: depositsKeys.freshness(id),
    queryFn: () => fetchDepositById(id),
    staleTime: STALE_TIMES.CRITICAL,
    enabled: false,
  });
}

/**
 * Validate (M4.3 Phase 3) — `POST /admin/depos/{id}/validate`.
 *
 * Invalidates via `"deposit.validated"` — `["deposits"]` ONLY. Re-verified
 * from source before registering this: neither the rapped path
 * (`agent.solde`/`agent.cash`) nor the grattage path (settles
 * `GrattageInvoice` rows) ever touches `agent.montant_avance_rapped`/
 * `montant_avance_grattage` — the ONLY columns Managers'/Commercials' own
 * `avanceTotal` is computed from (confirmed by reading both domains' own
 * mappers: neither reads `solde`/`cash` anywhere). Unlike
 * `cheque.approved`, no Network prefix is invalidated here — this is a
 * genuine difference in what the two actions actually touch, not an
 * oversight.
 *
 * No optimistic update, no automatic retry (FTA D-7, §11) — same
 * financial-workflow discipline as every Cheques mutation.
 */
export function useValidateDepositMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => validateDeposit(id),
    onSuccess: () => invalidateForEvent(queryClient, "deposit.validated"),
  });
}

/**
 * Reject (M4.3 Phase 3) — `POST /admin/depos/{id}/reject`. Requires
 * `reject_reason` (`required|string|min:10|max:1000` server-side); the
 * caller (`RejectDepositDialog`) collects and mirrors this exactly.
 *
 * Invalidates via `"deposit.rejected"` — `["deposits"]` only. Rejecting
 * touches no balance column and no `GrattageInvoice` status (only an
 * unlink for grattage) — confirmed from source.
 */
export function useRejectDepositMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectReason }: { id: number; rejectReason: string }) =>
      rejectDeposit(id, rejectReason),
    onSuccess: () => invalidateForEvent(queryClient, "deposit.rejected"),
  });
}

/**
 * Create (M4.3 Phase 4) — `POST /admin/depos`. Invalidates via
 * `"deposit.created"` — `["deposits"]` ONLY, same reasoning
 * `useCreateChequeMutation` already established for its own creation event:
 * a new deposit only ever adds a `pending` row. The legacy rapped+cash-method
 * side effect (`DepoController::store` adds to `currentAdmin->debt`) touches
 * `User.debt`, a column no Network list renders — re-verified from source
 * this phase, not assumed by analogy.
 *
 * No optimistic update, no automatic retry (FTA D-7, §11) — same
 * financial-workflow discipline as every other mutation in this domain.
 */
export function useCreateDepositMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CreateDepositFormValues) => createDeposit(values),
    onSuccess: () => invalidateForEvent(queryClient, "deposit.created"),
  });
}

/**
 * `GET /admin/agents/{id}` (M4.3 Phase 4) — Create Deposit's own read of the
 * agent's current `cash`, used to system-populate Amount on the `rapped`
 * branch. `LIVE` tier: this value can change between page load and submit
 * (another admin recording cheques/deposits against the same agent), and
 * `refetchOnWindowFocus` keeps it reasonably fresh — though, per the API
 * module's own docblock, this read is a UX hint only; the backend
 * re-verifies at submission time regardless.
 *
 * `enabled` gates on BOTH a chosen agent (`agentId` non-empty) AND
 * `type === "rapped"` — the caller does not fire this query at all while
 * viewing the grattage branch.
 */
export function useAgentCashQuery(agentId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: depositsKeys.agentCash(agentId),
    queryFn: () => fetchAgentCash(agentId),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * `GET /admin/agents/{id}/grattage-outstanding` (M4.3 Phase 4) — Create
 * Deposit's own read used to system-populate Amount on the `grattage`
 * branch. Same `LIVE` tier and same "UX hint only" caveat as
 * `useAgentCashQuery` — see `fetchGrattageOutstanding`'s own docblock.
 *
 * `enabled` gates on a chosen agent AND `type === "grattage"`.
 */
export function useGrattageOutstandingQuery(
  agentId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: depositsKeys.grattageOutstanding(agentId),
    queryFn: () => fetchGrattageOutstanding(agentId),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * `GET /admin/grattage-invoices?deposit_id={id}` (M6 Phase 4) — Deposit
 * Detail's own "linked invoices" panel. `LIVE` tier, same reasoning every
 * other Grattage-adjacent read in this file already carries.
 *
 * `enabled` is the CALLER'S responsibility, and it is NOT just "a deposit
 * is loaded" — the page gates this on BOTH `deposit.type === "grattage"`
 * (a `rapped` deposit can never have linked invoices) AND
 * `has(PERMISSIONS.ACCESS_DASHBOARD)` INDEPENDENTLY of the `view-depos`
 * permission this whole page already required to be reached — the two
 * are genuinely separate grants (verified from source: `GrattageInvoice
 * Controller::index` carries its own `permission:access-dashboard`
 * middleware, distinct from `DepoController`'s own `view-depos`), so an
 * operator holding one is not guaranteed to hold the other. Failing to
 * gate here would fire an unauthorized request and surface a raw 403
 * error for a section the operator was never meant to see at all.
 */
export function useLinkedGrattageInvoicesQuery(
  depositId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: depositsKeys.linkedGrattageInvoices(depositId),
    queryFn: () => fetchLinkedGrattageInvoices(depositId),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

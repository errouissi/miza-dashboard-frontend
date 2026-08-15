import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE_TIMES, invalidateForEvent } from "@/infrastructure/query";
import {
  cancelGrattageInvoice,
  fetchClientGrattageInvoices,
  fetchGrattageInvoiceById,
  fetchGrattageInvoices,
} from "../api/grattage-invoices-api";
import type { GrattageInvoiceListParams } from "../model/grattage-invoice";
import { grattageInvoicesKeys } from "./keys";

/** Client 360 Phase 3's own compact-panel page size — see `fetchClientGrattageInvoices`'s own docblock for why this is caller-supplied, not hardcoded there. */
const CLIENT_GRATTAGE_INVOICES_PAGE_SIZE = 5;

/**
 * Grattage Invoices data hooks (FTA §8) — the first Grattage resource
 * (roadmap M6, Phase 1).
 *
 * `LIVE` TIER — `stale-times.ts`'s own docblock names "outstanding
 * grattage, restock-gate state" explicitly under this tier; the invoice
 * list/detail read the same underlying financial-queue data.
 */
export function useGrattageInvoicesQuery(params: GrattageInvoiceListParams) {
  return useQuery({
    queryKey: grattageInvoicesKeys.list(params),
    queryFn: () => fetchGrattageInvoices(params),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
  });
}

/**
 * A single invoice. Same `LIVE` tier as the list. `enabled` guards a
 * malformed `:id` route param, the same pattern every prior detail query
 * already established.
 */
export function useGrattageInvoiceQuery(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: grattageInvoicesKeys.detail(id),
    queryFn: () => fetchGrattageInvoiceById(id),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * Client 360 Phase 3 — the authoritative, Client-filtered purchase-history
 * read (`ClientGrattagePanel`'s only query). Same `LIVE` tier as the
 * general list/detail — this is the identical underlying financial-queue
 * data, not a new classification. Fixed at page 1,
 * `CLIENT_GRATTAGE_INVOICES_PAGE_SIZE` (5) — a compact workspace-panel
 * read, never a full browsable list; `query.data.total` (from the real
 * paginator) is what the panel discloses truthfully when it exceeds 5, not
 * anything derived here. `enabled` is the caller's own `access-dashboard`
 * gate — this hook makes no permission decision itself, mirroring every
 * other secondary-permission query in this codebase
 * (`useVilleOptionsQuery({ enabled })`, etc.).
 */
export function useClientGrattageInvoicesQuery(
  clientId: number,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: grattageInvoicesKeys.clientList(clientId, 1),
    queryFn: () =>
      fetchClientGrattageInvoices(clientId, 1, CLIENT_GRATTAGE_INVOICES_PAGE_SIZE),
    staleTime: STALE_TIMES.LIVE,
    refetchOnWindowFocus: true,
    enabled: options.enabled ?? true,
  });
}

/**
 * The freshness-rule read (FTA §8, ADR-0018), read by
 * `CancelGrattageInvoiceDialog`. `enabled: false` — this observer never
 * fetches on its own; `useFreshConfirm` drives it via an explicit
 * `refetch()` the instant the dialog opens.
 */
export function useGrattageInvoiceFreshnessQuery(id: number) {
  return useQuery({
    queryKey: grattageInvoicesKeys.freshness(id),
    queryFn: () => fetchGrattageInvoiceById(id),
    staleTime: STALE_TIMES.CRITICAL,
    enabled: false,
  });
}

/**
 * Cancel — `PUT /admin/grattage-invoices/{id}/cancel`. Irreversible (FTA
 * D-7, §11): no optimistic update, no automatic retry.
 *
 * Invalidates via `"grattage-invoice.cancelled"` — `["grattage-invoices"]`
 * ONLY (registered in `invalidation-map.ts`). Re-verified from source
 * before registering this: `SalesService::cancelSale` restores the
 * commercial's stock via `StockService::cancelSale` (`stock_movements`/
 * `stocks` rows only) — no frontend query anywhere currently reads a
 * COMMERCIAL's own available stock reactively (Return's/Bons' own "add
 * line" pickers use the unfiltered product catalogue; Allocations'/
 * Transfers' own use company/manager-side stock, never commercial-side),
 * so there is no Stock cache to bust. No balance column is touched either
 * (grattage never writes `solde`/`cash`/`dept` — the module's own
 * invariant).
 */
export function useCancelGrattageInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelGrattageInvoice(id),
    onSuccess: () => invalidateForEvent(queryClient, "grattage-invoice.cancelled"),
  });
}

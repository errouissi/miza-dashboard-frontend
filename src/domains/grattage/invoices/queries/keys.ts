import type { GrattageInvoiceListParams } from "../model/grattage-invoice";

/**
 * The Grattage Invoices query-key factory (FTA §8) — FLAT, matching every
 * Money/Stock resource's own already-established deviation from FTA §8's
 * `[domain,resource,...]` prose.
 */
export const grattageInvoicesKeys = {
  all: ["grattage-invoices"] as const,
  lists: () => [...grattageInvoicesKeys.all, "list"] as const,
  list: (params: GrattageInvoiceListParams) =>
    [...grattageInvoicesKeys.lists(), params] as const,
  details: () => [...grattageInvoicesKeys.all, "detail"] as const,
  detail: (id: number) => [...grattageInvoicesKeys.details(), id] as const,
  /**
   * The freshness-rule read (FTA §8, ADR-0018) — its OWN key, deliberately
   * NOT `detail(id)`: TanStack Query's error/success state is shared
   * across every observer of one key, so sharing it would let a transient
   * verification failure flip this page's own detail query into an error
   * state too. `CancelGrattageInvoiceDialog` is this key's only reader.
   */
  freshness: (id: number) => [...grattageInvoicesKeys.detail(id), "freshness"] as const,
  /**
   * Client 360 Phase 3 — the Client-filtered read
   * (`useClientGrattageInvoicesQuery`). DELIBERATELY NESTED under `all`
   * (`["grattage-invoices", "client", clientId, page]`), NOT a separate
   * top-level key space (unlike `commercialStockQuantityKeys`'s own
   * deliberately-separate design) — four existing `invalidation-map.ts`
   * events (`deposit.validated`, `deposit.rejected`, `deposit.created`,
   * `grattage-invoice.cancelled`) already invalidate `["grattage-invoices"]`
   * broadly; nesting here means all four continue to cover this cache for
   * free, via TanStack's own prefix matching. A separate top-level space
   * would silently go stale on every one of those four events. See
   * `client-grattage-panel.tsx`'s own docblock for the full reasoning.
   */
  byClient: (clientId: number) =>
    [...grattageInvoicesKeys.all, "client", clientId] as const,
  clientList: (clientId: number, page: number) =>
    [...grattageInvoicesKeys.byClient(clientId), page] as const,
};

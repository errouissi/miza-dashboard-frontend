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
};

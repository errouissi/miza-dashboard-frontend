export {
  GRATTAGE_INVOICES_PATH,
  GRATTAGE_INVOICE_DETAIL_PATH,
  grattageInvoiceDetailPath,
  grattageInvoicesRoutes,
} from "./routes";

/**
 * Client 360 Phase 3 (FTA §4 — a domain may read another's PUBLIC surface
 * with a documented coupling) — the SECOND sanctioned Network←Grattage
 * import, alongside `AgentOutstandingPanel`'s own `domains/grattage/outstanding`
 * import (a different Grattage submodule, a different backend contract).
 * `useClientGrattageInvoicesQuery` was the ONLY data read exported from
 * this module through Client 360 — widened once more below for M7
 * Overview Phase 1, its own second real caller. `GrattageInvoice` and the
 * status vocabulary are exported alongside both purely for their callers'
 * own typing/`StatusBadge` reuse — reusing the SAME status labels/tones
 * this domain's own list page already renders, not a second, caller-
 * specific interpretation.
 */
export {
  useClientGrattageInvoicesQuery,
  useGrattageInvoicesQuery,
} from "./queries/grattage-invoices-queries";
export {
  GRATTAGE_INVOICE_LIST_DEFAULTS,
  GRATTAGE_INVOICE_STATUS_LABELS,
  GRATTAGE_INVOICE_STATUS_TONES,
  type GrattageInvoice,
  type GrattageInvoiceListParams,
  type GrattageInvoiceStatus,
} from "./model/grattage-invoice";

/**
 * `useGrattageInvoicesQuery`/`GRATTAGE_INVOICE_LIST_DEFAULTS`/
 * `GrattageInvoiceListParams` — widened for M7 Overview Phase 1
 * (`OverdueGrattageWidget`), the SAME general query the domain's own list
 * page already calls, not a new implementation. This is the general
 * query's first caller outside this domain — mechanism 1 (page-level
 * composition, FTA §4), the identical pattern `useClientGrattageInvoicesQuery`
 * already established for Client 360. NO `perPage` control exists on this
 * type (see its own docblock) — Overview's widget requests the backend's
 * own default page and slices client-side for its compact display, the
 * same restraint already documented there, not worked around here.
 *
 * api/, `useGrattageInvoiceQuery`/detail, mutations, components/ and the
 * pages stay internal. Every `*_PATH` constant is exported only because
 * `route-authorization.test.tsx` (outside this domain) needs it for its
 * own parametrized coverage array. `grattageInvoiceDetailPath` is exported
 * alongside `GRATTAGE_INVOICE_DETAIL_PATH` because the raw pattern
 * (`/grattage/invoices/:id`) is not itself a navigable URL.
 */

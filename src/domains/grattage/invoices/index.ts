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
 * `useClientGrattageInvoicesQuery` is the ONLY data read exported from this
 * module — the smallest surface `ClientGrattagePanel` needs, not the whole
 * domain. `GrattageInvoice` and the status vocabulary are exported
 * alongside it purely for that one caller's own typing/`StatusBadge`
 * reuse — reusing the SAME status labels/tones this domain's own list page
 * already renders, not a second, Client-specific interpretation.
 */
export { useClientGrattageInvoicesQuery } from "./queries/grattage-invoices-queries";
export {
  GRATTAGE_INVOICE_STATUS_LABELS,
  GRATTAGE_INVOICE_STATUS_TONES,
  type GrattageInvoice,
  type GrattageInvoiceStatus,
} from "./model/grattage-invoice";

// api/, the general list/detail queries, components/ and the pages stay
// internal. Every `*_PATH` constant is exported only because
// `route-authorization.test.tsx` (outside this domain) needs it for its
// own parametrized coverage array. `grattageInvoiceDetailPath` is exported
// alongside `GRATTAGE_INVOICE_DETAIL_PATH` because the raw pattern
// (`/grattage/invoices/:id`) is not itself a navigable URL.

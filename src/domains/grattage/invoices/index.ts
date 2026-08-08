export {
  GRATTAGE_INVOICES_PATH,
  GRATTAGE_INVOICE_DETAIL_PATH,
  grattageInvoiceDetailPath,
  grattageInvoicesRoutes,
} from "./routes";

// api/, model/, queries/, components/ and the pages stay internal. No
// sibling domain reads this resource's own reads or types yet (FTA §4).
// Every `*_PATH` constant is exported only because
// `route-authorization.test.tsx` (outside this domain) needs it for its
// own parametrized coverage array. `grattageInvoiceDetailPath` is exported
// alongside `GRATTAGE_INVOICE_DETAIL_PATH` because the raw pattern
// (`/grattage/invoices/:id`) is not itself a navigable URL.

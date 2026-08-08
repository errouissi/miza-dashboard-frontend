import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { GrattageInvoicesListPage } from "./pages/grattage-invoices-list-page";
import { GrattageInvoiceDetailPage } from "./pages/grattage-invoice-detail-page";

/**
 * Grattage Invoices route contributions (FTA §5) — roadmap M6, Phase 1
 * (list + detail + cancel, action inside the detail page, no route of its
 * own).
 *
 * BOTH ROUTES ARE GATED ON `access-dashboard` — mirroring the backend
 * exactly: `GET /admin/grattage-invoices` AND `GET
 * /admin/grattage-invoices/{id}` both carry `permission:access-dashboard`
 * (`routes/api.php:382-393`), the same coarse posture reference data uses,
 * NOT a dedicated `view-grattage-invoices` string (see `registry.ts`'s own
 * `ACCESS_DASHBOARD` docblock for the full reasoning, including the
 * unused `GrattageSalePermissions` catalogue entries this deliberately
 * does not gate on).
 *
 * TWO FLAT SIBLING ROUTES, not nested `children` — the same ADR-0014/FE-2
 * reasoning every prior domain's own routes file already established.
 */
export const GRATTAGE_INVOICES_PATH = "/grattage/invoices";
export const GRATTAGE_INVOICE_DETAIL_PATH = "/grattage/invoices/:id";

/** Builds a concrete detail link/navigation target for a given invoice id. */
export function grattageInvoiceDetailPath(id: number): string {
  return `/grattage/invoices/${id}`;
}

export const grattageInvoicesRoutes: RouteObject[] = [
  {
    path: GRATTAGE_INVOICES_PATH,
    element: <GrattageInvoicesListPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Grattage Invoices",
    },
  },
  {
    path: GRATTAGE_INVOICE_DETAIL_PATH,
    element: <GrattageInvoiceDetailPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Grattage Invoice",
    },
  },
];

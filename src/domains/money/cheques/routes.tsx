import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ChequesListPage } from "./pages/cheques-list-page";

/**
 * Cheques route contributions (FTA §5) — the first Money route, and the
 * first resource outside Network.
 *
 * The ROUTE is gated on `view-cheques`, mirroring the backend exactly:
 * `GET /admin/cheques` carries `permission:view-cheques`
 * (`routes/api.php:251-253`). The other five Cheque permissions gate
 * ACTIONS inside the page (once a later M4.2 phase builds them), because
 * that is where the backend enforces them — gating the route on, say,
 * `approve-cheque` would hide a list a read-only operator is entitled to
 * see.
 *
 * NO CHILDREN, deliberately — same reasoning as every prior domain
 * (ADR-0014, FE-2). A Cheque detail page is a later M4.2 phase; adding a
 * nested route before FE-2 is fixed would be an authorization hole, not a
 * convenience.
 */
export const CHEQUES_PATH = "/money/cheques";

export const chequesRoutes: RouteObject[] = [
  {
    path: CHEQUES_PATH,
    element: <ChequesListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_CHEQUES,
      breadcrumb: "Cheques",
    },
  },
];

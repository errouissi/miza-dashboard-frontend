import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { DepositsListPage } from "./pages/deposits-list-page";

/**
 * Deposits route contributions (FTA §5) — M4.3 Phase 1, list only.
 *
 * The LIST route is gated on `view-depos`, mirroring the backend exactly:
 * `GET /admin/depos` carries `permission:view-depos`
 * (`routes/api.php:373-374`). The three remaining Deposit permissions
 * (`create-depo`/`validate-depo`/`reject-depo`) gate ACTIONS/routes that do
 * not exist yet (Detail page, Validate, Reject, Create — later M4.3
 * phases) — not built here.
 */
export const DEPOSITS_PATH = "/money/deposits";

export const depositsRoutes: RouteObject[] = [
  {
    path: DEPOSITS_PATH,
    element: <DepositsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_DEPOSITS,
      breadcrumb: "Deposits",
    },
  },
];

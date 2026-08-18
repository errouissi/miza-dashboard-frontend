import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { StockMovementsListPage } from "./pages/stock-movements-list-page";

/**
 * Stock Movements route contributions (FTA §5) — Phase 2C, the read-only
 * audit ledger that Stock Overview's own "View movements" action drills
 * into (`/stock/movements?product_id=<id>`, a literal path string per
 * ADR-0030's precedent — Stock Overview does not import from this domain).
 *
 * ONE FLAT ROUTE, gated on `PERMISSIONS.ACCESS_DASHBOARD` — the SAME coarse
 * permission the backend actually checks (`GET /admin/stock/movements`
 * carries `permission:access-dashboard`, verified fresh from source,
 * `StockController::middleware()`), mirroring Stock Overview's own posture
 * exactly (both are network-wide reads, not movement workflows like the
 * four resources below them in the Stock nav group).
 */
export const STOCK_MOVEMENTS_PATH = "/stock/movements";

export const stockMovementsRoutes: RouteObject[] = [
  {
    path: STOCK_MOVEMENTS_PATH,
    element: <StockMovementsListPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Stock Movements",
    },
  },
];

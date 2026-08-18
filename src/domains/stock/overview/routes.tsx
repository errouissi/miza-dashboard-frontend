import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { StockOverviewPage } from "./pages/stock-overview-page";

/**
 * Stock Overview route contributions (FTA §5) — Phase 2B, the first Stock
 * screen that is a network-wide read rather than a movement workflow.
 *
 * ONE FLAT ROUTE, gated on `PERMISSIONS.ACCESS_DASHBOARD` — the SAME
 * coarse permission the backend actually checks (`GET /admin/stock`
 * carries `permission:access-dashboard`, verified from source) — no new
 * permission was registered or required.
 */
export const STOCK_OVERVIEW_PATH = "/stock/overview";

export const stockOverviewRoutes: RouteObject[] = [
  {
    path: STOCK_OVERVIEW_PATH,
    element: <StockOverviewPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Stock Overview",
    },
  },
];

import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AdminsListPage } from "./pages/admins-list-page";

/**
 * Admins route contributions (FTA §5).
 *
 * The ROUTE is gated on `access-dashboard`, mirroring the backend exactly:
 * `GET /admin/admins` carries `permission:access-dashboard`, not a granular one.
 * The granular strings (create/update/block/delete-admin) gate ACTIONS inside the
 * page, because that is where the backend enforces them.
 *
 * Gating the route on `create-admin` would be stricter than the server and would
 * hide a list an operator is entitled to read; gating the actions on
 * `access-dashboard` would be looser and would show controls the server refuses.
 * Mirroring per-route is the only option that cannot drift.
 */
export const ADMINS_PATH = "/network/admins";

export const adminsRoutes: RouteObject[] = [
  {
    path: ADMINS_PATH,
    element: <AdminsListPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Admins",
    },
  },
];

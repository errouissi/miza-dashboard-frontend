import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { SecteursListPage } from "./pages/secteurs-list-page";

/**
 * Secteurs route contributions (FTA §5).
 *
 * The permission is DECLARED here and the guard is generated from it by the route
 * assembler — it is never hand-wrapped, so a route cannot exist without one.
 *
 * `ACCESS_DASHBOARD` is the honest value: every secteurs action is gated behind
 * that single coarse permission server-side (`SecteurController::middleware()`).
 * There is no `view-secteurs` / `create-secteur` to point at.
 */
export const SECTEURS_PATH = "/reference/secteurs";

export const secteursRoutes: RouteObject[] = [
  {
    path: SECTEURS_PATH,
    element: <SecteursListPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Sectors",
    },
  },
];

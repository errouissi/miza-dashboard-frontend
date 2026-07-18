import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { VillesListPage } from "./pages/villes-list-page";

/**
 * Villes route contributions (FTA §5) — the first domain to use the contract the
 * route table documented in M1-B.
 *
 * The permission is DECLARED in `handle`, not hand-wrapped in a guard here. The
 * assembler (app/router/routes.tsx) generates the guard from this declaration, so
 * a route cannot exist without one — there is no code path in which to forget it.
 *
 * `breadcrumb` is carried but not rendered anywhere yet: Design System §2 puts the
 * breadcrumb in the PAGE header, and that ships with PageHeader.
 */
export const VILLES_PATH = "/reference/villes";

export const villesRoutes: RouteObject[] = [
  {
    path: VILLES_PATH,
    element: <VillesListPage />,
    handle: {
      permission: PERMISSIONS.ACCESS_DASHBOARD,
      breadcrumb: "Cities",
    },
  },
];

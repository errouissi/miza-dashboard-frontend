import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { BonsListPage } from "./pages/bons-list-page";
import { CreateBonPage } from "./pages/create-bon-page";
import { BonDetailPage } from "./pages/bon-detail-page";

/**
 * Bons route contributions (FTA §5) — the fifth and final Stock resource
 * (roadmap M5, Phase 5).
 *
 * THREE FLAT SIBLING ROUTES, not nested `children` — same ADR-0014/FE-2
 * reasoning every Money `*_NEW_PATH` and every prior Stock resource's own
 * routes already established.
 *
 * PERMISSIONS ARE GATED IN FORMREQUESTS, NOT ROUTE MIDDLEWARE — same
 * genuine departure every prior Stock domain already documents (confirmed
 * from source, `routes/api.php`'s own `bons` group has no
 * `->middleware('permission:...')` calls at all).
 *
 * `VIEW_BONS` IS PLURAL — copied verbatim from the backend constant
 * (`BonPermissions::VIEW = 'view-bons'`), matching Transfer's/Allocation's
 * own plurality, not Return's own singular.
 *
 * NO EDIT ROUTE, NO DELETE ROUTE — `PATCH`/`DELETE /admin/bons/{id}` both
 * exist server-side, but neither was in this phase's approved scope
 * ("draft -> add lines -> validate -> cancel"). Cancel itself has NO
 * dedicated route either — it is an action on the detail page, the same
 * pattern Validate already uses across every Stock resource.
 */
export const BONS_PATH = "/stock/bons";
export const BON_NEW_PATH = "/stock/bons/new";
export const BON_DETAIL_PATH = "/stock/bons/:id";

/** Builds a concrete detail link/navigation target for a given bon id. */
export function bonDetailPath(id: number): string {
  return `/stock/bons/${id}`;
}

export const bonsRoutes: RouteObject[] = [
  {
    path: BONS_PATH,
    element: <BonsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_BONS,
      breadcrumb: "Bons",
    },
  },
  {
    path: BON_NEW_PATH,
    element: <CreateBonPage />,
    handle: {
      permission: PERMISSIONS.CREATE_BON,
      breadcrumb: "Record bon",
    },
  },
  {
    path: BON_DETAIL_PATH,
    element: <BonDetailPage />,
    handle: {
      permission: PERMISSIONS.VIEW_BONS,
      breadcrumb: "Bon",
    },
  },
];

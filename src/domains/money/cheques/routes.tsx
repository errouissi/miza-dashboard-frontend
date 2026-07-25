import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ChequesListPage } from "./pages/cheques-list-page";
import { CreateChequePage } from "./pages/create-cheque-page";

/**
 * Cheques route contributions (FTA §5) — the first Money route, and the
 * first resource outside Network.
 *
 * The LIST route is gated on `view-cheques`, mirroring the backend exactly:
 * `GET /admin/cheques` carries `permission:view-cheques`
 * (`routes/api.php:251-253`). The CREATE route is gated on `create-cheque`,
 * mirroring `POST /admin/cheques`'s own `permission:create-cheque`. The
 * three remaining Cheque permissions (`approve-cheque`/`reject-cheque`/
 * `annuler-cheque`) gate ACTIONS inside the list/detail pages (later M4.2
 * phases), because that is where the backend enforces them.
 *
 * TWO FLAT, SIBLING ROUTES — the first Money route array to hold more than
 * one. Not nested `children`: `CHEQUES_NEW_PATH` is its own top-level path,
 * same reasoning as every prior domain (ADR-0014, FE-2) — a Cheque detail
 * page is a later M4.2 phase; adding a nested route before FE-2 is fixed
 * would be an authorization hole, not a convenience.
 */
export const CHEQUES_PATH = "/money/cheques";
export const CHEQUES_NEW_PATH = "/money/cheques/new";

export const chequesRoutes: RouteObject[] = [
  {
    path: CHEQUES_PATH,
    element: <ChequesListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_CHEQUES,
      breadcrumb: "Cheques",
    },
  },
  {
    path: CHEQUES_NEW_PATH,
    element: <CreateChequePage />,
    handle: {
      permission: PERMISSIONS.CREATE_CHEQUE,
      breadcrumb: "Create cheque",
    },
  },
];

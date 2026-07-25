import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ChequesListPage } from "./pages/cheques-list-page";
import { CreateChequePage } from "./pages/create-cheque-page";
import { PendingChequesPage } from "./pages/pending-cheques-page";
import { ChequeDetailPage } from "./pages/cheque-detail-page";

/**
 * Cheques route contributions (FTA §5) — the first Money route, and the
 * first resource outside Network.
 *
 * The LIST route is gated on `view-cheques`, mirroring the backend exactly:
 * `GET /admin/cheques` carries `permission:view-cheques`
 * (`routes/api.php:251-253`). The CREATE route is gated on `create-cheque`,
 * mirroring `POST /admin/cheques`'s own `permission:create-cheque`. The
 * PENDING route (M4.2 Phase 3B) is gated on its OWN permission,
 * `view-pending-cheques` — `GET /admin/cheques/pending` is a distinct
 * backend check from the general list, so a session can hold one without
 * the other. The DETAIL route (Phase 3B) is gated on `view-cheques`,
 * mirroring `GET /admin/cheques/{id}`'s own check — the SAME permission as
 * the list route it sits beside. The two remaining Cheque permissions
 * (`approve-cheque`/`reject-cheque`/`annuler-cheque`) still gate ACTIONS
 * inside the detail page (a later M4.2 phase, not built here), because that
 * is where the backend enforces them.
 *
 * FOUR FLAT, SIBLING ROUTES — not nested `children`. `CHEQUE_DETAIL_PATH`
 * (`/money/cheques/:id`) is its own top-level path, same reasoning as
 * `CHEQUES_NEW_PATH` before it (ADR-0014, FE-2): the route assembler's
 * `withPermissionGuards` is shallow, so a route nested under `CHEQUES_PATH`
 * would silently inherit `CHEQUES_PATH`'s own guard instead of its own
 * `handle.permission` — harmless here since both happen to be
 * `view-cheques` today, but a flat sibling avoids relying on that
 * coincidence. React Router ranks static segments (`/new`, `/pending`)
 * above a dynamic one (`/:id`) regardless of array order, so there is no
 * routing ambiguity between them.
 */
export const CHEQUES_PATH = "/money/cheques";
export const CHEQUES_NEW_PATH = "/money/cheques/new";
export const CHEQUES_PENDING_PATH = "/money/cheques/pending";
export const CHEQUE_DETAIL_PATH = "/money/cheques/:id";

/** Builds a concrete detail link/navigation target for a given cheque id. */
export function chequeDetailPath(id: number): string {
  return `/money/cheques/${id}`;
}

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
  {
    path: CHEQUES_PENDING_PATH,
    element: <PendingChequesPage />,
    handle: {
      permission: PERMISSIONS.VIEW_PENDING_CHEQUES,
      breadcrumb: "Pending cheques",
    },
  },
  {
    path: CHEQUE_DETAIL_PATH,
    element: <ChequeDetailPage />,
    handle: {
      permission: PERMISSIONS.VIEW_CHEQUES,
      breadcrumb: "Cheque",
    },
  },
];

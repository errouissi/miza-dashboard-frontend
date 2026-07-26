import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { DepositsListPage } from "./pages/deposits-list-page";
import { CreateDepositPage } from "./pages/create-deposit-page";
import { DepositDetailPage } from "./pages/deposits-detail-page";

/**
 * Deposits route contributions (FTA §5) — M4.3 Phase 1 (list) + Phase 2
 * (detail) + Phase 3 (Validate/Reject, actions inside the detail page, no
 * new route) + Phase 4 (Create).
 *
 * The LIST route is gated on `view-depos`, mirroring the backend exactly:
 * `GET /admin/depos` carries `permission:view-depos`
 * (`routes/api.php:373-374`). The DETAIL route (Phase 2) is gated on the
 * SAME `view-depos` — `GET /admin/depos/{depo}` shares its own permission
 * check with the list. The CREATE route (Phase 4) is gated on `create-depo`,
 * mirroring `POST /admin/depos`'s own `permission:create-depo`.
 * `validate-depo`/`reject-depo` still gate ACTIONS inside the detail page
 * (Phase 3), not routes of their own.
 *
 * THREE FLAT SIBLING ROUTES, not nested `children` — the same ADR-0014/FE-2
 * reasoning `CHEQUE_DETAIL_PATH` already established: `withPermissionGuards`
 * is shallow, so a route nested under `DEPOSITS_PATH` would silently
 * inherit ITS guard instead of its own `handle.permission` — harmless here
 * since both happen to be `view-depos` today, but a flat sibling avoids
 * relying on that coincidence. React Router ranks the static `/new` segment
 * above the dynamic `/:id` regardless of array order (same fact Cheques'
 * own `CHEQUES_NEW_PATH` already relies on), so there is no routing
 * ambiguity between them.
 *
 * NO SHARED `DetailPage` PATTERN — this phase's own product decision
 * (confirmed explicitly): the codebase's Rule-of-Three (CLAUDE.md) is not
 * met with two consumers (Cheques, now Deposits); a shared shell is
 * deferred until a third resource's detail page needs the identical
 * header + facts + body shape.
 */
export const DEPOSITS_PATH = "/money/deposits";
export const DEPOSIT_NEW_PATH = "/money/deposits/new";
export const DEPOSIT_DETAIL_PATH = "/money/deposits/:id";

/** Builds a concrete detail link/navigation target for a given deposit id. */
export function depositDetailPath(id: number): string {
  return `/money/deposits/${id}`;
}

export const depositsRoutes: RouteObject[] = [
  {
    path: DEPOSITS_PATH,
    element: <DepositsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_DEPOSITS,
      breadcrumb: "Deposits",
    },
  },
  {
    path: DEPOSIT_NEW_PATH,
    element: <CreateDepositPage />,
    handle: {
      permission: PERMISSIONS.CREATE_DEPOSIT,
      breadcrumb: "Create deposit",
    },
  },
  {
    path: DEPOSIT_DETAIL_PATH,
    element: <DepositDetailPage />,
    handle: {
      permission: PERMISSIONS.VIEW_DEPOSITS,
      breadcrumb: "Deposit",
    },
  },
];

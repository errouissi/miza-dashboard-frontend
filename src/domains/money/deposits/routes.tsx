import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { DepositsListPage } from "./pages/deposits-list-page";
import { DepositDetailPage } from "./pages/deposits-detail-page";

/**
 * Deposits route contributions (FTA §5) — M4.3 Phase 1 (list) + Phase 2
 * (detail).
 *
 * The LIST route is gated on `view-depos`, mirroring the backend exactly:
 * `GET /admin/depos` carries `permission:view-depos`
 * (`routes/api.php:373-374`). The DETAIL route (Phase 2) is gated on the
 * SAME `view-depos` — `GET /admin/depos/{depo}` shares its own permission
 * check with the list. The two remaining Deposit permissions
 * (`create-depo`/`validate-depo`/`reject-depo`) gate ACTIONS/routes that do
 * not exist yet (Validate, Reject, Create — later M4.3 phases) — not built
 * here.
 *
 * TWO FLAT SIBLING ROUTES, not nested `children` — the same ADR-0014/FE-2
 * reasoning `CHEQUE_DETAIL_PATH` already established: `withPermissionGuards`
 * is shallow, so a route nested under `DEPOSITS_PATH` would silently
 * inherit ITS guard instead of its own `handle.permission` — harmless here
 * since both happen to be `view-depos` today, but a flat sibling avoids
 * relying on that coincidence.
 *
 * NO SHARED `DetailPage` PATTERN — this phase's own product decision
 * (confirmed explicitly): the codebase's Rule-of-Three (CLAUDE.md) is not
 * met with two consumers (Cheques, now Deposits); a shared shell is
 * deferred until a third resource's detail page needs the identical
 * header + facts + body shape.
 */
export const DEPOSITS_PATH = "/money/deposits";
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
    path: DEPOSIT_DETAIL_PATH,
    element: <DepositDetailPage />,
    handle: {
      permission: PERMISSIONS.VIEW_DEPOSITS,
      breadcrumb: "Deposit",
    },
  },
];

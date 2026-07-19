import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { CommercialsListPage } from "./pages/commercials-list-page";

/**
 * Commercials route contributions (FTA §5).
 *
 * The ROUTE is gated on `view-agents`, mirroring the backend exactly:
 * `GET /admin/agents/commercials` carries `permission:view-agents`
 * (`routes/api.php:203-204`) — the SAME string that gates Managers' route,
 * because both endpoints sit behind one controller and one permission set.
 *
 * The granular strings (update/block/activate-agent) gate ACTIONS inside the
 * page, exactly as they do for Managers.
 *
 * NO CHILDREN, deliberately — same reasoning as Managers. A commercial detail
 * page is specified by the frozen architecture but deferred to a later M3
 * milestone (ADR-0014), and until FE-2 is fixed a nested route's own
 * `handle.permission` would be silently ignored in favour of this one's.
 */
export const COMMERCIALS_PATH = "/network/commercials";

export const commercialsRoutes: RouteObject[] = [
  {
    path: COMMERCIALS_PATH,
    element: <CommercialsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_AGENTS,
      breadcrumb: "Commercials",
    },
  },
];

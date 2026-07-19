import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ManagersListPage } from "./pages/managers-list-page";

/**
 * Managers route contributions (FTA §5).
 *
 * The ROUTE is gated on `view-agents`, mirroring the backend exactly:
 * `GET /admin/agents/managers` carries `permission:view-agents`
 * (`routes/api.php:199-200`). This is the FIRST domain route in the product gated
 * on something other than `access-dashboard` — reference data and Admins are both
 * behind that coarse string, agents are not.
 *
 * The granular strings (update/block/activate-agent) gate ACTIONS inside the page,
 * because that is where the backend enforces them. Gating the route on
 * `update-agent` would hide a list a read-only operator is entitled to see; gating
 * the actions on `view-agents` would show controls the server refuses.
 *
 * NO CHILDREN, deliberately. A manager detail page is specified by the frozen
 * architecture but deferred to a later M3 milestone (ADR-0014) — and until FE-2 is
 * fixed, a nested route's own `handle.permission` would be silently ignored in
 * favour of this one's. Adding a child here before that fix would be an
 * authorization hole, not a convenience.
 */
export const MANAGERS_PATH = "/network/managers";

export const managersRoutes: RouteObject[] = [
  {
    path: MANAGERS_PATH,
    element: <ManagersListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_AGENTS,
      breadcrumb: "Managers",
    },
  },
];

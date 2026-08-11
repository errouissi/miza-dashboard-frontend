import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ClientsListPage } from "./pages/clients-list-page";
import { ClientWorkspacePage } from "./pages/client-workspace-page";

/**
 * Clients route contributions (FTA §5).
 *
 * The LIST ROUTE is gated on `view-clients` — its own permission string,
 * not `view-agents`. Unlike Managers/Commercials, Clients sits behind a
 * separate `ClientController`, with its own permission set entirely
 * (`view-clients`, `update-client`, `manage-client-status`, and four more
 * this milestone does not use).
 *
 * `/network/clients/:id` — Client 360 (M7 Phase 1), a FLAT SIBLING of
 * `/network/clients`, not a nested child — the identical ADR-0014/FE-2
 * reasoning `AGENT_DETAIL_PATH` already established
 * (`domains/network/agents/routes.tsx`): `withPermissionGuards` is shallow
 * by design, so a nested child's own `handle.permission` would be silently
 * ignored in favour of its parent's. Gated on the SAME `view-clients`
 * permission as the list and as `GET /admin/clients/{id}` itself
 * (`ClientController::show`) — not `access-dashboard`, and not a new
 * permission string.
 */
export const CLIENTS_PATH = "/network/clients";
export const CLIENT_DETAIL_PATH = "/network/clients/:id";

/** Builds a concrete workspace link/navigation target for a given client id. */
export function clientDetailPath(id: number): string {
  return `/network/clients/${id}`;
}

export const clientsRoutes: RouteObject[] = [
  {
    path: CLIENTS_PATH,
    element: <ClientsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_CLIENTS,
      breadcrumb: "Clients",
    },
  },
  {
    path: CLIENT_DETAIL_PATH,
    element: <ClientWorkspacePage />,
    handle: {
      permission: PERMISSIONS.VIEW_CLIENTS,
      breadcrumb: "Client",
    },
  },
];

import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { ClientsListPage } from "./pages/clients-list-page";

/**
 * Clients route contributions (FTA §5).
 *
 * The ROUTE is gated on `view-clients` — its own permission string, not
 * `view-agents`. Unlike Managers/Commercials, Clients sits behind a
 * separate `ClientController`, with its own permission set entirely
 * (`view-clients`, `update-client`, `manage-client-status`, and five more
 * this milestone does not use).
 *
 * NO CHILDREN, deliberately — same reasoning as every prior domain. A
 * client detail page is specified by the frozen architecture but deferred
 * to a later M3 milestone (ADR-0014), and until FE-2 is fixed a nested
 * route's own `handle.permission` would be silently ignored in favour of
 * this one's.
 */
export const CLIENTS_PATH = "/network/clients";

export const clientsRoutes: RouteObject[] = [
  {
    path: CLIENTS_PATH,
    element: <ClientsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_CLIENTS,
      breadcrumb: "Clients",
    },
  },
];

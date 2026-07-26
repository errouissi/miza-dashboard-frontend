import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentTransfersListPage } from "./pages/agent-transfers-list-page";
import { CreateAgentTransferPage } from "./pages/create-agent-transfer-page";
import { AgentTransferDetailPage } from "./pages/agent-transfer-detail-page";

/**
 * Agent Transfers route contributions (FTA §5) — the second Stock resource
 * (roadmap M5, Phase 2).
 *
 * THREE FLAT SIBLING ROUTES, not nested `children` — same ADR-0014/FE-2
 * reasoning every Money `*_NEW_PATH` and Return's own routes already
 * established.
 *
 * PERMISSIONS ARE GATED IN FORMREQUESTS, NOT ROUTE MIDDLEWARE — same
 * genuine departure Return's own domain already documents (confirmed from
 * source, `routes/api.php`'s own `agent-transfers` group has no
 * `->middleware('permission:...')` calls at all). This route table still
 * gates on the SAME permission strings — `RequirePermission`'s own check is
 * a frontend-only convenience gate; the backend's FormRequest `authorize()`
 * remains the sole real authority regardless of what this table declares.
 *
 * `VIEW_AGENT_TRANSFERS` IS PLURAL — copied verbatim from the backend
 * constant (`AgentTransferPermissions::VIEW`), a genuine divergence from
 * Return's own singular `view-agent-stock-return` (see
 * `infrastructure/permissions/registry.ts`'s own docblock).
 *
 * NO DELETE ROUTE, NO EDIT ROUTE — `DELETE`/`PATCH
 * /admin/agent-transfers/{id}` both exist server-side, but neither was in
 * this phase's approved scope ("draft -> add lines -> validate").
 * Explicitly deferred, not a contract gap.
 */
export const AGENT_TRANSFERS_PATH = "/stock/agent-transfers";
export const AGENT_TRANSFER_NEW_PATH = "/stock/agent-transfers/new";
export const AGENT_TRANSFER_DETAIL_PATH = "/stock/agent-transfers/:id";

/** Builds a concrete detail link/navigation target for a given transfer id. */
export function agentTransferDetailPath(id: number): string {
  return `/stock/agent-transfers/${id}`;
}

export const agentTransfersRoutes: RouteObject[] = [
  {
    path: AGENT_TRANSFERS_PATH,
    element: <AgentTransfersListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_AGENT_TRANSFERS,
      breadcrumb: "Agent Transfers",
    },
  },
  {
    path: AGENT_TRANSFER_NEW_PATH,
    element: <CreateAgentTransferPage />,
    handle: {
      permission: PERMISSIONS.CREATE_AGENT_TRANSFER,
      breadcrumb: "Record transfer",
    },
  },
  {
    path: AGENT_TRANSFER_DETAIL_PATH,
    element: <AgentTransferDetailPage />,
    handle: {
      permission: PERMISSIONS.VIEW_AGENT_TRANSFERS,
      breadcrumb: "Transfer",
    },
  },
];

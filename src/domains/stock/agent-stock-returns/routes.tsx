import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentStockReturnsListPage } from "./pages/agent-stock-returns-list-page";
import { CreateAgentStockReturnPage } from "./pages/create-agent-stock-return-page";
import { AgentStockReturnDetailPage } from "./pages/agent-stock-return-detail-page";

/**
 * Agent Stock Returns route contributions (FTA §5) — the first Stock
 * resource (roadmap M5, Phase 1).
 *
 * THREE FLAT SIBLING ROUTES, not nested `children` — same ADR-0014/FE-2
 * reasoning every Money `*_NEW_PATH` already established.
 *
 * PERMISSIONS ARE GATED IN FORMREQUESTS, NOT ROUTE MIDDLEWARE — a genuine
 * departure from every prior domain (confirmed from source,
 * `routes/api.php`'s own `agent-stock-returns` group has no
 * `->middleware('permission:...')` calls at all). This route table still
 * gates on the SAME permission strings (`view-agent-stock-return`,
 * `create-agent-stock-return`) — `RequirePermission`'s own check is a
 * frontend-only convenience gate; the backend's FormRequest `authorize()`
 * remains the sole real authority regardless of what this table declares.
 *
 * NO DELETE ROUTE, NO EDIT ROUTE — `DELETE`/`PATCH
 * /admin/agent-stock-returns/{id}` both exist server-side
 * (`delete-agent-stock-return`/`update-agent-stock-return`), but neither
 * was in this phase's approved scope ("draft -> add lines -> validate").
 * Explicitly deferred, not a contract gap — revisit if a real need for
 * discarding or editing a draft's header fields appears.
 */
export const AGENT_STOCK_RETURNS_PATH = "/stock/agent-stock-returns";
export const AGENT_STOCK_RETURN_NEW_PATH = "/stock/agent-stock-returns/new";
export const AGENT_STOCK_RETURN_DETAIL_PATH = "/stock/agent-stock-returns/:id";

/** Builds a concrete detail link/navigation target for a given return id. */
export function agentStockReturnDetailPath(id: number): string {
  return `/stock/agent-stock-returns/${id}`;
}

export const agentStockReturnsRoutes: RouteObject[] = [
  {
    path: AGENT_STOCK_RETURNS_PATH,
    element: <AgentStockReturnsListPage />,
    handle: {
      permission: PERMISSIONS.VIEW_AGENT_STOCK_RETURN,
      breadcrumb: "Agent Stock Returns",
    },
  },
  {
    path: AGENT_STOCK_RETURN_NEW_PATH,
    element: <CreateAgentStockReturnPage />,
    handle: {
      permission: PERMISSIONS.CREATE_AGENT_STOCK_RETURN,
      breadcrumb: "Record stock return",
    },
  },
  {
    path: AGENT_STOCK_RETURN_DETAIL_PATH,
    element: <AgentStockReturnDetailPage />,
    handle: {
      permission: PERMISSIONS.VIEW_AGENT_STOCK_RETURN,
      breadcrumb: "Stock return",
    },
  },
];

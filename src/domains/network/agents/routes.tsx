import type { RouteObject } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentWorkspacePage } from "./pages/agent-workspace-page";

/**
 * Agent route contributions (FTA §5) — roadmap M7, Phase 1.
 *
 * ONE FLAT ROUTE, gated on `view-agents` — mirroring the backend exactly:
 * `GET /admin/agents/{identifier}` carries `permission:view-agents`
 * (`routes/api.php:244-245`), the SAME string `MANAGERS_PATH`/
 * `COMMERCIALS_PATH` already use, since `show()` sits behind the identical
 * `agents` route group.
 *
 * `/network/agents/:id` — matches FTA §5's own routing table verbatim
 * (`/network/agents/{id} -> WorkspacePage (Agent 360)`) and stays a FLAT
 * sibling, not nested under `/network/managers`/`/network/commercials` —
 * the same ADR-0014/FE-2 reasoning every prior domain's own routes file
 * already established: `withPermissionGuards` is shallow by design, and a
 * nested child's own `handle.permission` would be silently ignored in
 * favour of its parent's.
 */
export const AGENT_DETAIL_PATH = "/network/agents/:id";

/** Builds a concrete workspace link/navigation target for a given agent id. */
export function agentDetailPath(id: number): string {
  return `/network/agents/${id}`;
}

export const agentsRoutes: RouteObject[] = [
  {
    path: AGENT_DETAIL_PATH,
    element: <AgentWorkspacePage />,
    handle: {
      permission: PERMISSIONS.VIEW_AGENTS,
      breadcrumb: "Agent",
    },
  },
];

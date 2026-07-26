import { httpClient } from "@/infrastructure/http";

/**
 * `GET /admin/agents/{manager}/sub-data` (`view-agents`) — re-verified
 * fresh from source this phase (`AgentController::getAgentSubData`'s own
 * MANAGER branch): returns the manager's own commercials, paginated,
 * `{success, agent_selected, type:"commercials", data: <paginator>}`.
 *
 * WHY THIS READ, NOT `useCommercialOptionsQuery` — `CommercialOption`
 * (Commercials' own public surface) deliberately excludes `manager_id`
 * (verified: `indexCommercials`' own transform never puts it on the wire
 * at all — confirmed from source, not merely undocumented). Agent Stock
 * Returns' own creation rule requires `commercial.manager_id ===
 * manager_id` (`StoreAgentStockReturnRequest::withValidator`), so a picker
 * built from `CommercialOption` could never guarantee that binding. This
 * endpoint sidesteps the gap entirely: since the manager is already fixed
 * by the URL param, EVERY row it returns already belongs to that manager
 * by construction — no client-side re-check is needed or attempted.
 *
 * KEPT INSIDE THIS DOMAIN (`stock/agent-stock-returns/`), NOT Network's
 * Managers/Commercials — this read exists because of AGENT STOCK RETURN'S
 * OWN binding rule, not because Managers/Commercials need it. The
 * equivalent need will recur for Agent Transfers (Phase 2, the SAME
 * manager->commercial binding rule, re-verified independently rather than
 * assumed) — whether that phase reuses this file or keeps its own copy is
 * a decision for that phase, not resolved ahead of it.
 *
 * `status` IS NOT FILTERED SERVER-SIDE — `Agent::commercials()` is a plain
 * `hasMany`, no status scope (verified from source). The caller filters to
 * `status === "active"` before rendering options, mirroring the
 * `StoreAgentStockReturnRequest` rule this picker exists to satisfy
 * (`exists:agents,id` where `status=active`).
 *
 * BOUNDED AT `per_page=100` (BC-H) — the same real-but-currently-invisible
 * limit every picker source in this product carries; a manager with over
 * 100 commercials would see a truncated list.
 */
export type ManagerCommercialRow = {
  id: number;
  nom: string;
  prenom: string;
  status: "active" | "blocked" | "inactive";
};

type SubDataEnvelope = {
  success: boolean;
  type: string;
  data: {
    data: ManagerCommercialRow[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

export async function fetchManagerCommercials(
  managerId: string,
): Promise<ManagerCommercialRow[]> {
  const { data } = await httpClient.get<SubDataEnvelope>(
    `/admin/agents/${managerId}/sub-data`,
    { params: { per_page: 100 } },
  );
  return data.data.data;
}

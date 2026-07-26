import { httpClient } from "@/infrastructure/http";

/**
 * `GET /admin/agents/{manager}/sub-data` (`view-agents`) — verified fresh
 * from source this phase (`AgentController::getAgentSubData`'s own MANAGER
 * branch): returns the manager's own commercials, paginated,
 * `{success, agent_selected, type:"commercials", data: <paginator>}`.
 *
 * OWN COPY, DELIBERATELY NOT SHARED WITH AGENT STOCK RETURN'S IDENTICAL
 * FILE — this phase's explicit decision #2: with only two consumers in the
 * roadmap (Return, Transfer), the Manager -> Commercial cascading picker
 * does not meet the Rule-of-Three bar for a shared abstraction. Allocation's
 * own binding rule uses a completely different counterpart pair
 * (`company_id` + `agent_id(role=manager)`, no manager<->commercial
 * relationship at all — re-verified this phase), so this pattern will never
 * reach a third consumer.
 *
 * WHY THIS READ, NOT `useCommercialOptionsQuery` — same reasoning Return's
 * own copy already documents: `CommercialOption` deliberately excludes
 * `manager_id`, so a picker built from it could never guarantee
 * `commercial.manager_id === manager_id`, the binding
 * `StoreAgentTransferRequest::withValidator` requires. Since the manager is
 * already fixed by the URL param, every row this endpoint returns already
 * belongs to that manager by construction — no client-side re-check needed.
 *
 * KEPT INSIDE THIS DOMAIN (`stock/agent-transfers/`), NOT Network's
 * Managers/Commercials, NOT Return's own — this read exists because of
 * AGENT TRANSFER'S OWN binding rule.
 *
 * `status` IS NOT FILTERED SERVER-SIDE — `Agent::commercials()` is a plain
 * `hasMany`, no status scope (verified from source). The caller filters to
 * `status === "active"` before rendering options, mirroring the
 * `StoreAgentTransferRequest` rule this picker exists to satisfy
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

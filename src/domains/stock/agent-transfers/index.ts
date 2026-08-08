export {
  AGENT_TRANSFERS_PATH,
  AGENT_TRANSFER_NEW_PATH,
  AGENT_TRANSFER_DETAIL_PATH,
  agentTransferDetailPath,
  agentTransfersRoutes,
} from "./routes";

/**
 * The read surface Agent 360's own Stock panel composes (M7 Phase 2,
 * mechanism 1). `AGENT_TRANSFER_LIST_DEFAULTS`/`AgentTransferListParams`
 * already model both `managerId` and `commercialId` (M5 Phase 2) — a
 * Commercial's own Agent 360 panel filters by `commercialId`, verified
 * fresh from source (`IndexAgentTransferRequest`) to be genuinely applied
 * server-side. No new filter, no new query.
 *
 * `useManagerStockQuery` is exported here too — it already lives in this
 * domain (ADR-0025: the "add line" availability read stayed with its first
 * real caller, this domain's own create form, rather than moving to
 * Managers or a neutral Stock module). Agent 360's Manager Stock panel is
 * this hook's SECOND real caller; it still belongs here, not duplicated.
 */
export {
  useAgentTransfersQuery,
  useManagerStockQuery,
} from "./queries/agent-transfers-queries";
export {
  AGENT_TRANSFER_LIST_DEFAULTS,
  AGENT_TRANSFER_STATUS_LABELS,
  AGENT_TRANSFER_STATUS_TONES,
  type AgentTransfer,
  type AgentTransferListParams,
} from "./model/agent-transfer";
export type { ManagerStockItem } from "./api/manager-stock-api";

// api/, mutations, components/ and the pages stay internal. No sibling
// domain reads this resource's data beyond the above (FTA §4). Every
// `*_PATH` constant is exported only because `route-authorization.test.tsx`
// (outside this domain) needs it for its own parametrized coverage array.

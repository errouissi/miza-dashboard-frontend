export {
  AGENT_STOCK_RETURNS_PATH,
  AGENT_STOCK_RETURN_NEW_PATH,
  AGENT_STOCK_RETURN_DETAIL_PATH,
  agentStockReturnDetailPath,
  agentStockReturnsRoutes,
} from "./routes";

/**
 * The read surface Agent 360's own Stock panel composes (M7 Phase 2,
 * mechanism 1). `AGENT_STOCK_RETURN_LIST_DEFAULTS`/
 * `AgentStockReturnListParams` already model both `managerId` and
 * `commercialId` (M5 Phase 1) — a Commercial's own Agent 360 panel filters
 * by `commercialId`, verified fresh from source
 * (`IndexAgentStockReturnRequest`) to be genuinely applied server-side. No
 * new filter, no new query.
 */
export { useAgentStockReturnsQuery } from "./queries/agent-stock-returns-queries";
export {
  AGENT_STOCK_RETURN_LIST_DEFAULTS,
  AGENT_STOCK_RETURN_STATUS_LABELS,
  AGENT_STOCK_RETURN_STATUS_TONES,
  type AgentStockReturn,
  type AgentStockReturnListParams,
} from "./model/agent-stock-return";

// api/, mutations, components/ and the pages stay internal. No sibling
// domain reads this resource's data beyond the above (FTA §4). Every
// `*_PATH` constant is exported only because `route-authorization.test.tsx`
// (outside this domain) needs it for its own parametrized coverage array.

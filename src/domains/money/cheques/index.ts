export {
  CHEQUES_PATH,
  CHEQUES_NEW_PATH,
  CHEQUES_PENDING_PATH,
  CHEQUE_DETAIL_PATH,
  chequeDetailPath,
  chequesRoutes,
} from "./routes";

/**
 * The read surface Agent 360's own Money panel composes (M7 Phase 2,
 * mechanism 1). `CHEQUE_LIST_DEFAULTS`/`ChequeListParams` already model
 * `agentId` (M4.2) — no new filter, no new query. The dedicated
 * `GET /admin/cheques/agent/{agentId}` endpoint exists but is deliberately
 * NOT used here: the generic list's own `agent_id` filter already covers
 * the exact same need with zero new modelling (M7 Phase 2 discovery).
 */
export { useChequesQuery } from "./queries/cheques-queries";
export {
  CHEQUE_LIST_DEFAULTS,
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_TONES,
  type Cheque,
  type ChequeListParams,
} from "./model/cheque";

// api/, mutations, components/ and the pages stay internal. No sibling
// domain reads this resource's picker or public surface beyond the above
// (FTA §4) — nothing is exported ahead of a real caller. Every `*_PATH`
// constant (including the new `CHEQUES_PENDING_PATH`/`CHEQUE_DETAIL_PATH`,
// Phase 3B) is exported only because `route-authorization.test.tsx` (outside
// this domain) needs it for its own parametrized coverage array. `chequeDetailPath`
// is exported alongside `CHEQUE_DETAIL_PATH` because the raw pattern
// (`/money/cheques/:id`) is not itself a navigable URL — `nav.ts`/list pages
// and tests need the id-substituted builder, not the route pattern.

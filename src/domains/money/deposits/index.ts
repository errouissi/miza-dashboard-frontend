export {
  DEPOSITS_PATH,
  DEPOSIT_NEW_PATH,
  DEPOSIT_DETAIL_PATH,
  depositDetailPath,
  depositsRoutes,
} from "./routes";

/**
 * The read surface Agent 360's own Money panel composes (M7 Phase 2,
 * mechanism 1 — "composition at the page": the workspace page imports this
 * domain's own public surface, this domain learns nothing about Agent 360).
 * `DEPOSIT_LIST_DEFAULTS`/`DepositListParams` already model `agentId` (M4.3)
 * — no new filter, no new query, just a narrower door onto what already
 * exists. `DEPOSIT_STATUS_LABELS`/`DEPOSIT_STATUS_TONES` are exported
 * alongside so a second renderer of a Deposit row does not invent its own
 * status vocabulary.
 */
export { useDepositsQuery } from "./queries/deposits-queries";
export {
  DEPOSIT_LIST_DEFAULTS,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_STATUS_TONES,
  /** Widened for M7 Overview Phase 1 (`PendingDepositsWidget`) — the same domain-owned `type` vocabulary, not a second interpretation. */
  DEPOSIT_TYPE_LABELS,
  type Deposit,
  type DepositListParams,
} from "./model/deposit";

// api/, mutations, components/ and the pages stay internal. No sibling
// domain reads this resource's picker or public surface beyond the above
// (FTA §4). Every `*_PATH` constant is exported only because
// `route-authorization.test.tsx` (outside this domain) needs it for its
// own parametrized coverage array. `depositDetailPath` is exported
// alongside `DEPOSIT_DETAIL_PATH` because the raw pattern
// (`/money/deposits/:id`) is not itself a navigable URL — the list page
// and tests need the id-substituted builder, not the route pattern.

export {
  ALLOCATIONS_PATH,
  ALLOCATION_NEW_PATH,
  ALLOCATION_DETAIL_PATH,
  allocationDetailPath,
  allocationsRoutes,
} from "./routes";

/**
 * The read surface Agent 360's own Manager Stock panel composes (M7
 * Phase 2, mechanism 1). `ALLOCATION_LIST_DEFAULTS`/`AllocationListParams`
 * already model `agentId` (M5 Phase 4) — verified fresh from source this
 * phase (`IndexAllocationRequest`) that it is the RECIPIENT MANAGER's own
 * id, exactly the actor Agent 360's Manager panel needs to filter by. No
 * new filter, no new query.
 */
export { useAllocationsQuery } from "./queries/allocations-queries";
export {
  ALLOCATION_LIST_DEFAULTS,
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_STATUS_TONES,
  type Allocation,
  type AllocationListParams,
} from "./model/allocation";

// api/, mutations, components/ and the pages stay internal. No sibling
// domain reads this resource's data beyond the above (FTA §4). Every
// `*_PATH` constant is exported only because `route-authorization.test.tsx`
// (outside this domain) needs it for its own parametrized coverage array.

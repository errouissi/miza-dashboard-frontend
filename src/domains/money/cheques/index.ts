export {
  CHEQUES_PATH,
  CHEQUES_NEW_PATH,
  CHEQUES_PENDING_PATH,
  CHEQUE_DETAIL_PATH,
  chequeDetailPath,
  chequesRoutes,
} from "./routes";

// api/, model/, queries/, components/ and the pages stay internal. No
// sibling domain reads this resource's picker or public surface yet
// (FTA §4) — nothing is exported ahead of a real caller. Every `*_PATH`
// constant (including the new `CHEQUES_PENDING_PATH`/`CHEQUE_DETAIL_PATH`,
// Phase 3B) is exported only because `route-authorization.test.tsx` (outside
// this domain) needs it for its own parametrized coverage array. `chequeDetailPath`
// is exported alongside `CHEQUE_DETAIL_PATH` because the raw pattern
// (`/money/cheques/:id`) is not itself a navigable URL — `nav.ts`/list pages
// and tests need the id-substituted builder, not the route pattern.

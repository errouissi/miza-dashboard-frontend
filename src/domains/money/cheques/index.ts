export { CHEQUES_PATH, CHEQUES_NEW_PATH, chequesRoutes } from "./routes";

// api/, model/, queries/, components/ and the pages stay internal. No
// sibling domain reads this resource's picker or public surface yet
// (FTA §4) — nothing is exported ahead of a real caller. `CHEQUES_NEW_PATH`
// is exported only because `route-authorization.test.tsx` (outside this
// domain) needs it for its own parametrized coverage array, the same
// reason every other `*_PATH` constant here is public.

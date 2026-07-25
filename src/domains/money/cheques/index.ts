export { CHEQUES_PATH, chequesRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. No
// sibling domain reads this resource's picker or public surface yet
// (FTA §4) — nothing is exported ahead of a real caller.

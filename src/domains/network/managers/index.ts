export { MANAGERS_PATH, managersRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. The app layer
// needs the route contributions and the path (for the nav entry) — nothing else
// (FTA §4).
//
// Nothing is exported for siblings yet. M3.3 (Commercials) will need a MANAGER
// PICKER, and that is where a public options query belongs — added then, against
// the real caller, rather than guessed at now (FTA D-11). Note BC-H when it lands:
// the agents list is bounded at per_page=100 like every other picker source.

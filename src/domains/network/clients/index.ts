export { CLIENTS_PATH, clientsRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. The app
// layer needs the route contributions and the path (for the nav entry) —
// nothing else (FTA §4).
//
// Nothing is exported for siblings yet. No known future need has been
// identified for a Clients picker — added then, against the real caller,
// rather than guessed at now (FTA D-11).

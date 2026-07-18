export { SECTEURS_PATH, secteursRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. The app layer
// needs the route contributions and the path (for the nav entry) — nothing else
// (FTA §4). Villes remains the source of truth for ville data; this domain
// re-exports none of it.

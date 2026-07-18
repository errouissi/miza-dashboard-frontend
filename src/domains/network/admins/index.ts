export { ADMINS_PATH, adminsRoutes } from "./routes";

// api/, model/, queries/, components/ and the page stay internal. The app layer
// needs the route contributions and the path (for the nav entry) — nothing else
// (FTA §4). No sibling domain consumes admins.

export { VILLES_PATH, villesRoutes } from "./routes";

/**
 * The ville set, for relation pickers in sibling reference domains (FTA §4 —
 * a domain may read another's PUBLIC surface with a documented coupling).
 *
 * Villes remains the single source of truth for ville data: consumers read this
 * one query and derive from it. No sibling domain fetches, stores or caches ville
 * names of its own.
 */
export { useVilleOptionsQuery } from "./queries/villes-queries";
export type { Ville } from "./model/ville";

// Everything else — api/, the list query, mutations, components, the page — stays
// internal. The app layer needs the routes and the path; siblings need the picker.

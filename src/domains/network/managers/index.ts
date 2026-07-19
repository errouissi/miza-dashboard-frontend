export { MANAGERS_PATH, managersRoutes } from "./routes";

/**
 * The manager set, for relation pickers in sibling Network domains (FTA §4 —
 * a domain may read another's public surface with a documented coupling).
 *
 * Added now, against the real caller (M3.3's Commercials manager filter),
 * exactly as flagged when Managers shipped (FTA D-11 — no picker was exported
 * ahead of a caller that needed one). BC-H applies: bounded at `per_page=100`,
 * like every other picker source in this product.
 */
export { useManagerOptionsQuery } from "./queries/managers-queries";
export type { ManagerOption } from "./model/manager";

// api/, the list query, mutations, components, the page and the full Manager
// type stay internal. Siblings get the picker surface above — nothing else.

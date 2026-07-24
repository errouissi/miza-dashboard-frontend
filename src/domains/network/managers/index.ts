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

/**
 * The area-of-responsibility multi-select, exported for the M3.6 onboarding
 * wizard's Identity step (manager role) — the SAME component and behavior
 * `ManagerFormSheet` already uses, not a second implementation. The backend
 * contract this component sits on top of is unchanged for this second
 * caller either: `value`/`onChange` are still exactly the one
 * `ville_sous_responsabilite` string (see the component's own docblock).
 */
export { ManagerAreaMultiSelect } from "./components/manager-area-multiselect";

// api/, the list query, mutations, the page and the full Manager type stay
// internal. Siblings get the picker surface and the area multi-select above
// — nothing else.

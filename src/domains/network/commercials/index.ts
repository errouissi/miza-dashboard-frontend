export { COMMERCIALS_PATH, commercialsRoutes } from "./routes";

/**
 * The active-commercial set, for relation pickers in sibling Network domains
 * (FTA §4 — a domain may read another's public surface with a documented
 * coupling).
 *
 * Added now, against the real caller (M3.5's Clients bulk-assign sheet),
 * exactly as flagged when Commercials shipped (FTA D-11 — no picker was
 * exported ahead of a caller that needed one). This is the SECOND instance of
 * this cross-domain picker-export pattern (Managers → Commercials was the
 * first) — not yet a Rule-of-Three case for generalizing it into a shared
 * hook.
 */
export { useCommercialOptionsQuery } from "./queries/commercials-queries";
export type { CommercialOption } from "./model/commercial";

// api/, model/, queries/, components/ and the page stay internal. Siblings
// get the picker surface above — nothing else.

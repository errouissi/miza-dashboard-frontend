export { SECTEURS_PATH, secteursRoutes } from "./routes";

/**
 * The secteur set, city-scoped, for the M3.6 onboarding wizard's Sector
 * field (FTA §4 — a domain may read another's public surface with a
 * documented coupling). `villeId` is a REAL foreign key here (unlike
 * `agents.secteur`, which BC-V found has none) — the wizard resolves the
 * operator's selected city NAME to a Villes id first, then reads this query
 * scoped to it. The value actually submitted to `AgentController::store` is
 * still the sector's NAME (a plain `nullable|string|max:255` column, no FK),
 * exactly like the wizard's city fields already send the city's name, not a
 * Villes id — this export only supplies the OPTIONS, not the payload shape.
 */
export { useSecteursQuery } from "./queries/secteurs-queries";
export type { Secteur } from "./model/secteur";

// api/, components/ and the page stay internal. The app layer needs the
// route contributions and the path (for the nav entry); siblings get the
// city-scoped secteur query above — nothing else. Villes remains the source
// of truth for ville data; this domain re-exports none of it.

/**
 * A manager — an agent with `role = manager`, and the second Network resource.
 *
 * THE LIST ROW IS NOT THE AGENT RECORD. `AgentController::indexManagers` runs the
 * paginator's collection through a `transform()` that renames almost everything and
 * drops the rest, so the wire keys are NOT the column names and the row is much
 * narrower than an agent. The mapper in `api/managers-api.ts` is where that stops
 * being anyone else's problem (FTA D-6).
 *
 * Fields on the wire and deliberately NOT modelled (ADR-0008 — a field is modelled
 * when a screen reads it, not before):
 *
 *   `app_version` — present on every row; no column shows it and nothing filters on
 *                   it. Modelling it would invite use and would have to be
 *                   maintained through backend changes for no caller.
 *
 * NOT on the wire at all, despite the eager load: `commercials`. The controller
 * calls `with(['commercials'])` and the transform then discards the collection —
 * only `withCount`'s `nombre_commerciaux` survives (BC-Q). There is no commercials
 * array to model, and code written expecting one would silently read `undefined`.
 */

/**
 * `avanceTotal` is a STRING, and that is deliberate rather than an oversight.
 *
 * The backend's `montant_avance` is not a `decimal:2` column — it is a computed
 * accessor, `bcadd(montant_avance_grattage, montant_avance_rapped, 2)`, which
 * returns an arbitrary-precision decimal already formatted to two places. Parsing
 * it into a JavaScript number would take a value the backend computed exactly and
 * put it through binary floating point, which is the one thing money must not do.
 *
 * So it is carried across the boundary verbatim and rendered verbatim. No
 * `parseMoney`, no `formatMoney`, no shared money abstraction: `formatMoney` takes
 * a `number` and would require exactly the parse this avoids.
 */
export type Manager = {
  id: number;
  nom: string;
  prenom: string;
  status: ManagerStatus;
  /**
   * The subscription identifier (`num_abonnement` on the wire).
   *
   * NULLABLE, though nothing about the name suggests it — confirmed against
   * `agents.num_abonnement` (`nullable()` in the schema) and against a live record
   * with no subscription set. The edit form must seed a null as `""`, not pass it
   * through: an uncontrolled input's DOM value cannot legally be `null`.
   */
  numAbonnement: string | null;
  /** The account number (`num_de_compte` on the wire, `num_compte` in the DB). */
  numDeCompte: string;
  /** Backend-preformatted decimal string, 2dp. NEVER parsed. See above. */
  avanceTotal: string;
  /**
   * NULLABLE, same trap as `numAbonnement` — `agents.ville` is `nullable()` in the
   * schema. Every seeded record so far has had one, which is exactly how this went
   * unmodelled the first time.
   */
  ville: string | null;
  /**
   * Nullable on the wire — a manager may have no assigned area of
   * responsibility. A manager may be responsible for MULTIPLE cities; see the
   * parse/serialize functions below for how that is encoded into this single
   * backend string column without changing the backend contract.
   */
  villeSousResponsabilite: string | null;
  /** `withCount('commercials')`. Always an integer, never null. */
  nombreCommerciaux: number;
  /** `Y-M-D` on the wire (`date_debut`), or null. Rendered through `formatDate`. */
  dateDebut: string | null;
  /**
   * An absolute URL despite the wire key being `photo_path` — the controller
   * assigns the model's `photo_url` accessor to it. Null when no photo was uploaded.
   */
  photoUrl: string | null;
};

/**
 * The account status enum — THREE values, not a boolean.
 *
 * This is the product's first real status enum: Admins carry `is_active`, which is
 * a different vocabulary and does not generalise to this one. Per ADR-0006 a
 * `StatusBadge` needs three resources with real enums, so this is evidence #1 and
 * the labels below stay domain-owned.
 *
 * Mirrors `indexManagers`' validator (`in:active,blocked,inactive`) exactly.
 */
export const MANAGER_STATUSES = ["active", "blocked", "inactive"] as const;
export type ManagerStatus = (typeof MANAGER_STATUSES)[number];

/** Domain-owned labels. Temporary English pending O-1. No shared badge (ADR-0006). */
export const MANAGER_STATUS_LABELS: Record<ManagerStatus, string> = {
  active: "Active",
  blocked: "Blocked",
  inactive: "Inactive",
};

/**
 * The list query, mirroring `indexManagers`' validator exactly.
 *
 * THERE IS NO SORT FIELD, and its absence is the contract rather than an omission:
 * the endpoint accepts no `sort`, `direction` or `sort_by` parameter of any kind
 * and hardcodes `orderBy('date_ajout', 'desc')` (BC-L). Adding one here would
 * invent a capability the API does not have (ADR-0009).
 *
 * Empty strings mean "unfiltered" and are omitted from the request entirely — the
 * backend applies each filter through `$request->filled()`, so an empty value is
 * ignored server-side too. Keeping the two in agreement is what stops a "cleared"
 * filter from behaving differently from a never-set one.
 */
export type ManagerListParams = {
  page: number;
  perPage: number;
  search: string;
  /** `""` = every status. */
  status: ManagerStatus | "";
  /** EXACT match server-side (`where('ville', …)`), not a partial one. */
  ville: string;
  /** PARTIAL match server-side (`like %…%`) — unlike `ville`. */
  villeSousResponsabilite: string;
  /** `Y-M-D`. Compared against `date_ajout >=`. */
  dateFrom: string;
  /** `Y-M-D`. Compared against `date_ajout <=` — see BC-P, excludes its own day. */
  dateTo: string;
};

/**
 * Backend defaults, restated so the frontend's "unset" and the server's agree.
 *
 * `per_page` defaults to 15 (`paginate($request->per_page ?? 15)`). Ordering is
 * `date_ajout DESC` and is not expressible here because it is not a parameter.
 */
export const MANAGER_LIST_DEFAULTS: ManagerListParams = {
  page: 1,
  perPage: 15,
  search: "",
  status: "",
  ville: "",
  villeSousResponsabilite: "",
  dateFrom: "",
  dateTo: "",
};

/** `per_page` is capped server-side (`integer|min:1|max:100`). */
export const MAX_PER_PAGE = 100;

/**
 * A manager, reduced to what a relation picker needs — nothing this narrow
 * exists on the wire; it is sliced from the same `indexManagers` row a full
 * `Manager` is built from (FTA §4 — a domain may read another's public surface;
 * ADR-0008 — map only consumed fields, applied to a picker's consumer instead
 * of a screen).
 *
 * M3.3's first consumer: the Commercials manager filter. Both endpoints share
 * the `view-agents` gate, so unlike `useVilleOptionsQuery` (gated
 * `access-dashboard`, separate from Managers' own `view-agents`), no caller
 * needs a conditional mount here — anyone who can reach the Commercials list
 * can always resolve this query too.
 */
export type ManagerOption = {
  id: number;
  nom: string;
  prenom: string;
};

/**
 * `villeSousResponsabilite` MULTI-CITY ENCODING — a FRONTEND-ONLY convention,
 * not a backend contract change.
 *
 * Verified from source before choosing a delimiter, not guessed:
 *   - `agents.ville_sous_responsabilite` is a plain `string`, `nullable()`
 *     column (`create_agent_table.php:41`) — no cast in `Agent::$casts`, no
 *     accessor/mutator, so Eloquent reads/writes it as a bare string.
 *   - Every validator that touches it — `store()` (`nullable|string|max:255`),
 *     `update()` (`sometimes|nullable|string|max:255`) and the list filter
 *     (`sometimes|string|max:255`) — is `string`, never `array`.
 *   - The list filter does `where('ville_sous_responsabilite', 'like',
 *     "%{$ville}%")` — a substring match over that one string.
 *   - The only sample value anywhere in the codebase
 *     (`DevAgentSeeder.php:75`) is a single bare name, `'Casablanca'`. No
 *     delimiter convention exists anywhere in the backend.
 *
 * So the backend has no multi-value convention of its own to preserve — this
 * is where one is introduced, entirely on the frontend, as `", "`-joined city
 * names within the same single string the backend has always accepted. The
 * backend does not know or care that the string it stores now often holds
 * several names; it is still exactly one `string|nullable|max:255` value in
 * every request and response, unchanged.
 *
 * Comma was picked because the instructions offered it as the first example
 * and no Villes name contains one. `max:255` is unchanged and unenforced
 * beyond what zod already does for the field — picking enough cities to
 * exceed it fails the existing "This value is too long" validation exactly as
 * before, not a new behaviour.
 */
const AREA_DELIMITER = ", ";

/**
 * Splits the backend string into the selected city names, trimmed and
 * de-duplicated (first occurrence wins), preserving the order they appear in.
 * `null` or an all-whitespace string is "no cities" — `[]`.
 */
export function parseVilleSousResponsabiliteAreas(raw: string | null): string[] {
  if (!raw) return [];

  const seen = new Set<string>();
  const areas: string[] = [];
  for (const piece of raw.split(",")) {
    const trimmed = piece.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      areas.push(trimmed);
    }
  }
  return areas;
}

/**
 * The inverse: joins selected city names back into the one backend string,
 * trimmed and de-duplicated the same way, so a value that round-trips through
 * parse then serialize without being touched comes back byte-for-byte
 * identical. An empty array serializes to `""` — the existing "no area of
 * responsibility" convention, unchanged.
 */
export function serializeVilleSousResponsabiliteAreas(areas: readonly string[]): string {
  const seen = new Set<string>();
  const serialized: string[] = [];
  for (const area of areas) {
    const trimmed = area.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      serialized.push(trimmed);
    }
  }
  return serialized.join(AREA_DELIMITER);
}

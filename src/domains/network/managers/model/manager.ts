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
  /** Nullable on the wire — a manager may have no assigned area of responsibility. */
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

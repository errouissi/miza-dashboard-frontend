/**
 * A commercial — an agent with `role = commercial`, and the third Network
 * resource. Same controller, same permission set, same envelope shape as
 * Managers (`AgentController`), but a DIFFERENT index method
 * (`indexCommercials`) with its own transform, filters and row shape — verified
 * from source independently, not inherited from Managers by assumption. Two
 * prior contract-verification passes each found something the previous one
 * missed; inheriting this one's shape by resemblance would repeat that.
 *
 * Fields on the wire and deliberately NOT modelled (ADR-0008 — a field is
 * modelled when a screen reads it, not before):
 *
 *   `app_version` — same as Managers: present on every row, nothing reads it.
 *
 * NOT ON THE WIRE AT ALL, despite the filter accepting it: `secteur`. Unlike
 * Managers' `ville_sous_responsabilite`, the transform never includes it —
 * `secteur` can be filtered on but never displayed. Deferred by decision (no
 * secteurs are seeded in the dev database and there is no options source to
 * build a select from; a free-text box over an exact-match filter would be a
 * control that appears to work and does not, ADR-0009). Do not add a secteur
 * filter until a real options source exists.
 *
 * NOT MODELLED: `manager_id`. Only a formatted display string survives the
 * transform (`$commercial->manager->nom . ' ' . $commercial->manager->prenom`)
 * — there is no ID to seed a picker's selected value with, and reassigning a
 * commercial's manager is the Agent Transfers feature (already has full
 * backend infrastructure — `AgentTransferPermissions`, an `AgentTransfer`
 * model, dedicated feature tests), not a field on this edit form. It must not
 * appear here.
 */

/**
 * `avanceTotal` is a STRING, for the identical reason it is on `Manager`: the
 * backend's `montant_avance` accessor (`bcadd`) computes an arbitrary-precision
 * decimal already formatted to two places, from the SAME `Agent` model. Parsed
 * into a JS number it would go through binary floating point. Carried and
 * rendered verbatim. No `parseMoney`, no `formatMoney`, no shared abstraction —
 * this is the second resource of this exact shape, still short of ADR-0006's
 * three, and arguably anti-evidence for a shared `MoneyAmount` rather than
 * supporting one: this value and Products' `formatMoney`-rendered price are two
 * different kinds of "money", not the same shape twice.
 */
export type Commercial = {
  id: number;
  nom: string;
  prenom: string;
  status: CommercialStatus;
  /**
   * The subscription identifier (`num_abonnement` on the wire).
   *
   * NULLABLE — confirmed against `agents.num_abonnement` (`nullable()` in the
   * schema, the SAME column Managers reads) and against a live commercial
   * record with no subscription set. Seed a null as `""` in the edit form, not
   * pass it through: an uncontrolled input's DOM value cannot legally be null.
   * This is the exact defect the Managers implementation shipped and then
   * fixed live — modelled correctly here from the first draft.
   */
  numAbonnement: string | null;
  /** The account number (`num_de_compte` on the wire, `num_compte` in the DB). Never null (unique, not nullable). */
  numDeCompte: string;
  /** Backend-preformatted decimal string, 2dp. NEVER parsed. See above. */
  avanceTotal: string;
  /**
   * NULLABLE — `agents.ville_actuelle` is `nullable()`, confirmed against a
   * live record with none set. EXACT match server-side, not partial — see
   * `CommercialListParams.villeActuelle`.
   */
  villeActuelle: string | null;
  /**
   * A CONCATENATED DISPLAY STRING, not a relation. `null` when the commercial
   * has no manager assigned (`manager_id` is a nullable FK). There is no ID
   * here — see the module docblock for why that rules out seeding a picker
   * from this field.
   */
  manager: string | null;
  /** `Y-M-D` on the wire (`date_debut`), or null. Rendered through `formatDate`. */
  dateDebut: string | null;
  /**
   * An absolute URL despite the wire key being `photo_path` — the controller
   * assigns the model's `photo_url` accessor to it. Null when no photo was uploaded.
   */
  photoUrl: string | null;
};

/**
 * The account status enum — the SAME three values as `ManagerStatus`, kept as
 * its own type (ADR-0012 — no merged vocabulary across domains, even where the
 * strings are identical). Mirrors `indexCommercials`' validator
 * (`in:active,blocked,inactive`) exactly.
 */
export const COMMERCIAL_STATUSES = ["active", "blocked", "inactive"] as const;
export type CommercialStatus = (typeof COMMERCIAL_STATUSES)[number];

/** Domain-owned labels. Temporary English pending O-1. No shared badge (ADR-0006 — not yet at 3). */
export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatus, string> = {
  active: "Active",
  blocked: "Blocked",
  inactive: "Inactive",
};

/**
 * The list query, mirroring `indexCommercials`' validator exactly.
 *
 * NO SORT FIELD — the endpoint accepts none and hardcodes
 * `orderBy('date_ajout', 'desc')` (BC-L), identically to Managers.
 *
 * NO `secteur` FIELD — deferred by decision (see the module docblock).
 *
 * Empty strings/values mean "unfiltered" and are omitted from the request
 * entirely — `indexCommercials` gates each filter on `$request->filled()`, so
 * an empty value is ignored server-side too.
 */
export type CommercialListParams = {
  page: number;
  perPage: number;
  search: string;
  /** `""` = every status. */
  status: CommercialStatus | "";
  /** EXACT match server-side (`where('ville_actuelle', …)`) — same BC-S-class trap as Managers' `ville`. */
  villeActuelle: string;
  /**
   * The assigned manager's id, held as a string because it is read from and
   * written back to a `<select>` (whose values are always strings) and to the
   * URL. `""` = every manager. Converted to a number only at the API boundary.
   * EXACT match server-side (`where('manager_id', …)`); the validator accepts
   * any existing agent id, not only managers (`exists:agents,id` is not
   * role-scoped) — harmless in practice, a mismatched id just returns zero rows.
   */
  managerId: string;
  /** `Y-M-D`. Compared against `date_ajout >=`. */
  dateFrom: string;
  /** `Y-M-D`. Compared against `date_ajout <=` — see BC-P, excludes its own day, identically to Managers. */
  dateTo: string;
};

/**
 * Backend defaults, restated so the frontend's "unset" and the server's agree.
 *
 * `per_page` defaults to 15 (`paginate($request->per_page ?? 15)`). Ordering is
 * `date_ajout DESC` and is not expressible here because it is not a parameter.
 */
export const COMMERCIAL_LIST_DEFAULTS: CommercialListParams = {
  page: 1,
  perPage: 15,
  search: "",
  status: "",
  villeActuelle: "",
  managerId: "",
  dateFrom: "",
  dateTo: "",
};

/** `per_page` is capped server-side (`integer|min:1|max:100`). */
export const MAX_PER_PAGE = 100;

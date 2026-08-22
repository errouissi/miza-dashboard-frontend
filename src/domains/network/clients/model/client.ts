import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * A client — the fourth Network resource, and a structurally different
 * contract from every prior one. `ClientController::index` runs **no
 * `transform()`** — the row is the raw Eloquent serialization of the `Client`
 * model, the first time this product has exposed one directly. Verified from
 * source (`Client.php`, the `clients` migration) before modelling anything,
 * not inherited from Managers/Commercials by resemblance — the M3.4 planning
 * pass found the row shape, the status vocabulary and the action model all
 * differ from the Agent domains in ways a copy would have missed.
 *
 * Fields on the wire and deliberately NOT modelled (ADR-0008 — a field is
 * modelled when a screen reads it, not before). The raw-serialization row
 * carries far more than Managers/Commercials' hand-picked transform did:
 *
 *   `agent_id`, `latitude`, `longitude`, `location_updated_at`,
 *   `last_login_at`, `otp_expires_at`, `otp_verified_at`, `updated_at`,
 *   `dept_to_commercial` (the client's debt) — none of them read by this
 *   screen. Assignment (`agent_id`) and location are explicitly out of scope
 *   for this milestone (see below); the rest are backend-internal or simply
 *   unused by a list-and-edit screen.
 *
 * WIRE NAMES ARE NOT COLUMN NAMES, a third instance of the trap Managers'
 * `num_abonnement` and Commercials' `manager_id` already taught. `Client`
 * hides its raw `ville`/`secteur`/`debt` columns and re-`$appends`s them as
 * `ville_comercial`/`secteur_comercial`/`dept_to_commercial` — confirmed from
 * `Client::$hidden`/`$appends`, not guessed.
 */

/**
 * `solde` is a STRING, for a similar but not identical reason to Managers'
 * `avanceTotal`: `solde` is a real `decimal:2` CAST column (not a computed
 * `bcadd` accessor), but Eloquent still serializes a decimal cast to a
 * string in JSON, and parsing it into a JS number would be the same
 * needless trip through binary floating point. Carried and rendered
 * verbatim — no `parseMoney`, no shared `MoneyAmount`. This is a THIRD
 * distinct "money" shape in the product (Products: `formatMoney` over a
 * real number; Managers/Commercials: a `bcadd` accessor string; Clients: a
 * decimal-cast string) — further anti-evidence for one shared component,
 * not accumulating evidence toward it.
 *
 * Unlike Managers'/Commercials' money field, `solde` has a DB default (`0`)
 * and is never null — confirmed from the migration
 * (`$table->decimal('solde', 10, 2)->default(0)`).
 */
export type Client = {
  id: number;
  /** NOT NULL, unique. The Design System's Moroccan grouping (`shared/formatters`) applies. */
  phone: string;
  status: ClientStatus;
  /**
   * NULLABLE — `clients.ville` is `nullable()` in the migration, confirmed
   * against a live query pattern identical to Managers'/Commercials' own
   * city fields. Wire key is `ville_comercial`, not `ville` (see the module
   * docblock) — verified from `Client::$hidden`/`$appends`, not guessed.
   * EXACT match server-side (`scopeByVille`), like Managers'/Commercials'
   * city fields — same BC-S-class trap: a client whose city was typed
   * differently from the Villes reference list cannot be selected.
   */
  ville: string | null;
  /** Never null; see the module docblock for why it is a string. */
  solde: string;
  /**
   * A DISPLAY STRING derived from the eager-loaded `agent` relation
   * (`"{prenom} {nom}"`), or `null` when the client has no assigned agent
   * (`agent_id` is a nullable FK). Reduced to a string at the mapper
   * boundary rather than modelling a nested Agent-shaped object: this
   * screen only ever DISPLAYS who a client is assigned to — assignment,
   * reassignment and unassignment are explicitly out of scope for this
   * milestone (see the page's own docblock), so there is no picker to seed
   * and no reason to carry the agent's id, account number, or anything
   * else past what is shown.
   */
  agentName: string | null;
  /**
   * `created_at`, a full ISO-8601 timestamp — NOT the bare `Y-M-D` string
   * every Agent-domain date is. `formatDate` already parses either shape
   * correctly (`new Date(value)`), confirmed, so no change was needed there.
   * Typed nullable: Laravel's `$table->timestamps()` creates a nullable
   * column by default (no `useCurrent()` in this migration) — the same
   * "don't assume non-null from a name" discipline M3.2's own nullability
   * miss established.
   */
  dateDebut: string | null;
  /**
   * NULLABLE, same reasoning as `ville` — added for Client 360's Edit reuse
   * (M7 Phase 1): `ClientFormSheet` is shared between this list and the new
   * workspace, and the workspace's Profile/Edit both need it. Wire key is
   * `secteur_comercial` (`Client::$hidden`/`$appends`, same pattern as
   * `ville`/`ville_comercial`) — NOT rendered as a list column; only Edit
   * (and Client 360's own profile) reads it.
   */
  secteur: string | null;
};

/**
 * The account status enum — THREE real values, but a DIFFERENT vocabulary
 * from Managers'/Commercials' `active|blocked|inactive`: `pending` replaces
 * `inactive`, and it means something specific — a client who self-registered
 * through the public OTP flow and has not yet been approved. Mirrors
 * `ClientController::index`'s validator (`in:active,blocked,pending`) exactly,
 * in the same order.
 *
 * `pending` clients are NOT created by anything this milestone builds (create
 * is out of scope, and direct admin creation always forces `status: active`
 * per `ClientController::store`'s own comment) — they arrive from the public
 * registration flow, entirely outside this screen, so a real operator can
 * genuinely encounter one here despite this screen never producing one.
 */
export const CLIENT_STATUSES = ["active", "blocked", "pending"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/** Domain-owned labels. Temporary English pending O-1. */
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Active",
  blocked: "Blocked",
  pending: "Pending",
};

/**
 * Domain-owned tone mapping (Design System §17) for the shared `StatusBadge`.
 * `pending` is `warning`, not `neutral` — per §17's own table, `pending`
 * (Clients' OTP registration state) is explicitly one of the backend
 * statuses mapped to the warning tone, the same tone Cheques'/Deposits'
 * own `pending` will use once Money is built.
 */
export const CLIENT_STATUS_TONES: Record<ClientStatus, StatusTone> = {
  active: "success",
  blocked: "danger",
  pending: "warning",
};

/**
 * The list query, mirroring `ClientController::index`'s validator exactly.
 *
 * NO SORT FIELD — the endpoint accepts none and hardcodes
 * `orderBy('created_at', 'desc')`.
 *
 * NO DATE FILTER OF ANY KIND — unlike `indexManagers`/`indexCommercials`,
 * `index()`'s validator has no `date_from`/`date_to` at all. Not adding one
 * here is ADR-0009, not an oversight: the backend has nothing to filter on.
 *
 * NO `secteur_comercial` FIELD — deferred by the same decision as
 * Commercials' `secteur` (BC-V): no foreign key, zero seeded secteurs, no
 * options source to build a select from.
 *
 * `agentId` (Manager Demo Readiness, Item 3) — `ClientController::index`
 * already validates and applies an `agent_id` filter (`sometimes|integer|
 * exists:agents,id`); this was previously undocumented here because no
 * screen used it yet. Now consumed by Agent 360's Commercial-side Clients
 * panel (`AgentClientsPanel`) to scope the list to one Commercial's own
 * clients — optional and omitted from `CLIENT_LIST_DEFAULTS` since the
 * main Clients list page never scopes by agent.
 */
export type ClientListParams = {
  page: number;
  perPage: number;
  /** Partial match server-side (`like %…%` on `phone`) — digits only, so BC-O's case-sensitivity note does not apply here (a phone number has no case). */
  search: string;
  /** `""` = every status. */
  status: ClientStatus | "";
  /** `""` = both. Sent as the literal string `"true"`/`"false"`, matching the validator's `in:true,false,1,0`. */
  assigned: "" | "true" | "false";
  /** EXACT match server-side (`where('ville', …)` via `scopeByVille`). */
  ville: string;
  /** Optional — see the docblock above. Absent = unscoped, matching every existing caller. */
  agentId?: number;
};

/**
 * Backend defaults, restated so the frontend's "unset" and the server's agree.
 * `per_page` defaults to 15 (`paginate($request->per_page ?? 15)`). Ordering
 * is `created_at DESC` and is not expressible here because it is not a
 * parameter.
 */
export const CLIENT_LIST_DEFAULTS: ClientListParams = {
  page: 1,
  perPage: 15,
  search: "",
  status: "",
  assigned: "",
  ville: "",
};

/** `per_page` is capped server-side (`integer|min:1|max:100`). */
export const MAX_PER_PAGE = 100;

/**
 * Client 360 (M7 Phase 1) — the minimal detail model for `GET
 * /admin/clients/{id}` (`ClientController::show`, `Client::with(['agent'])
 * ->findOrFail($id)`).
 *
 * DELIBERATELY MINIMAL (ADR-0008), NOT THE FULL `show()` RESPONSE — the raw
 * serialization also carries `solde`, `debt`/`dept_to_commercial`,
 * `latitude`/`longitude`/`location_updated_at`, `last_login_at`,
 * `otp_expires_at`/`otp_verified_at`/`otp_code` (hidden), `updated_at`, and
 * `password`/`remember_token` (hidden) — none of them modelled here. Per the
 * Client 360 follow-up discovery: `solde`/`debt` have no authoritative
 * write workflow (Grattage is the Commercial's obligation to the company,
 * never a Client receivable — verified from `SalesService`'s own docblock),
 * location is a deferred map feature, and the OTP/system fields are
 * backend-internal. This is a DISTINCT type from the list's own `Client`
 * (different wire shape: `show()` eager-loads a full, unrestricted `agent`
 * relation, not the list's restricted `id,nom,prenom,num_compte` projection,
 * and a nested `commercial` reference — needed for Phase 2's deep link — is
 * a genuine widening the list row never carried).
 */
export type ClientDetailCommercial = {
  id: number;
  nom: string;
  prenom: string;
  numCompte: string;
};

export type ClientDetail = {
  id: number;
  phone: string;
  status: ClientStatus;
  /** Nullable — see `Client.ville`'s own docblock above; identical column. */
  ville: string | null;
  /** Nullable — see `Client.secteur`'s own docblock above; identical column. */
  secteur: string | null;
  /** Full ISO-8601, or null — identical column to `Client.dateDebut`, renamed per the Client 360 spec. */
  createdAt: string | null;
  /**
   * The CURRENT Commercial relationship only — `Client.agent_id` is the
   * sole source of truth for current ownership (verified from
   * `ClientAssignmentHistory`'s own model docblock: "this table is NEVER
   * read to derive current ownership"). Present here because Phase 2's deep
   * link needs `id`, not because Phase 2's relationship panel is being
   * built now — see `ClientWorkspacePage`'s own docblock for the Phase
   * boundary.
   */
  commercial: ClientDetailCommercial | null;
};

/**
 * Client 360 Phase 2 — the reassignment action's own input.
 *
 * `PATCH /admin/clients/{id}/assign` (`ClientController::reassign`), NOT
 * `POST /admin/clients/{id}/assign` (`assignToAgent`) — the two share a
 * path but are genuinely different endpoints, verified independently from
 * source during the Phase 2 discovery pass: `reassign` touches `agent_id`
 * ONLY (never rewrites `ville`/`secteur`, unlike `assignToAgent`), works
 * identically whether the Client starts assigned or unassigned (no
 * branching on the prior value), and returns a real, field-informative 422
 * on an ineligible target instead of `assignToAgent`'s bare 400. One
 * endpoint serves both the "Assign" and "Reassign" UI labels — see
 * `client-reassign-drawer.tsx`'s own docblock.
 */
export type ReassignClientInput = {
  agentId: number;
};

/**
 * Client 360 Phase 2 — the minimal frontend model for one
 * `GET /admin/clients/{id}/assignment-history` row (backend commit
 * `7066ffa`). Deliberately narrower than the wire resource
 * (`ClientAssignmentHistoryResource`): raw `from_agent_id`/`to_agent_id`/
 * `changed_by_user_id`/`changed_by_agent_id` are NOT carried past the
 * mapper boundary — only the loaded identities a row actually renders
 * (ADR-0008's discipline, applied here the same way `agentName`/
 * `ClientDetailCommercial` already reduce a relation to what a screen
 * reads, not what the wire carries).
 */
export type ClientAssignmentHistoryCommercial = {
  id: number;
  nom: string;
  prenom: string;
};

/**
 * At most one of `user`/`agent` is ever populated (verified from
 * `ClientAssignmentHistory`'s own docblock — every Admin-initiated
 * mutation records a `User` actor; the one exception, a Commercial
 * self-creating a Client, records an `Agent` actor instead). `null` is the
 * defensive fallback for a transition with no distinguishable actor — no
 * live backend path produces it today, but the Resource's own shape
 * allows it (both columns nullable), so the frontend must render it safely
 * rather than assume one is always present.
 */
export type ClientAssignmentHistoryActor =
  | { kind: "user"; id: number; name: string }
  | { kind: "agent"; id: number; nom: string; prenom: string }
  | null;

/**
 * The workspace panel's own page size — a compact "recent activity" read,
 * not a full history browser (no "Load more"/dedicated full-history page
 * exists yet — Phase 2 discovery decision). The endpoint accepts any
 * `1-100` value; `5` is chosen here, not by the backend.
 */
export const CLIENT_ASSIGNMENT_HISTORY_PAGE_SIZE = 5;

export const CLIENT_ASSIGNMENT_HISTORY_TYPES = [
  "assigned",
  "reassigned",
  "unassigned",
] as const;
export type ClientAssignmentHistoryType =
  (typeof CLIENT_ASSIGNMENT_HISTORY_TYPES)[number];

export type ClientAssignmentHistoryEntry = {
  id: number;
  type: ClientAssignmentHistoryType;
  /** `null` for `type === "assigned"` (no prior Commercial) OR when the referenced Agent row was hard-deleted (`nullOnDelete` — the raw id and the relation go null together). */
  fromCommercial: ClientAssignmentHistoryCommercial | null;
  /** `null` for `type === "unassigned"` OR a hard-deleted referenced Agent row (same reasoning as `fromCommercial`). */
  toCommercial: ClientAssignmentHistoryCommercial | null;
  actor: ClientAssignmentHistoryActor;
  /** Full ISO-8601 (`created_at?.toIso8601String()`), never null — every row has one by construction (`created_at` is `useCurrent()`, no nullable column). */
  changedAt: string;
};

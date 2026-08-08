import type { StatusTone } from "@/shared/components/business/status-badge";

/**
 * An Agent — the fifth Network resource (roadmap M7, Phase 1), and the FIRST
 * consumer of `GET /admin/agents/{id}`, the unified read `AgentController::show()`
 * already exposed since before M3 but never given a frontend caller (ADR-0014's
 * own deferral). This resolves that deferral: Agent 360 (`AgentWorkspacePage`) IS
 * the detail experience the frozen architecture always intended, not an interim
 * plain detail page later replaced by one (M7 discovery, G2).
 *
 * DELIBERATELY NOT `Manager`/`Commercial`. Those two types stay exactly as they
 * are (ADR-0012 — no merged vocabulary across domains), each modelling its own
 * endpoint's own hand-picked transform. This type models a THIRD, genuinely
 * different wire shape: `show()` returns `$agent->toArray()` on the raw Eloquent
 * model — no transform, no Resource class — so every column the `agents` table
 * has is present on every response, for BOTH roles, not a per-role-trimmed row.
 *
 * A DISCRIMINATED UNION, tagged on the response's top-level `role` — verified
 * from source that this is not an invented distinction: `store()` NULLS OUT
 * `ville_actuelle`/`secteur`/`manager_id` for a manager, and `ville_sous_
 * responsabilite` is never set for a commercial, so the role-specific fields
 * below are genuinely always meaningful for one role and genuinely always null
 * for the other — not two optional fields glued onto one flat shape.
 *
 * PHASE 1 SCOPE — IDENTITY/PROFILE FIELDS. Deliberately NOT modelled here
 * (ADR-0008 — a field is modelled when a screen reads it, not before), despite
 * being present on the wire:
 *   - `montant_avance_grattage/rapped`, `solde`, `cash`, `dept` — genuine
 *     Money/Grattage-relevant balances, no screen in this domain reads any
 *     of them. Stay excluded.
 *   - `moto`/`moto_id` — a distinct conditional sub-entity, explicitly
 *     tracked as separate future scope (M7 Phase 1.5 discovery, D1).
 *   - `created_at`/`updated_at` (Laravel's own timestamps, distinct from
 *     `date_ajout`) — no caller.
 *
 * PHASE 1.5 ADDITION — `salaire`, `montantEssence`, `montantDeclarationCnss`,
 * `chargeAutoEntrepreneur`. Genuinely Agent-owned HR/payroll fields (no
 * relation to Cheques/Deposits/Grattage Invoices), added because
 * `AgentEditDrawer` reads and submits all four — not modelled ahead of that
 * caller (M7 Phase 1.5 discovery, D3). Each is a `decimal:2`-cast STRING on
 * the wire (`Agent::$casts`), same discipline as every other money-shaped
 * field in this product — carried verbatim here too. `AgentEditDrawer` does
 * its own local parsing at the point of editing (see that component's own
 * docblock for why `salaire`/`montantDeclarationCnss`/`chargeAutoEntrepreneur`
 * must be re-derived as whole-number strings for their inputs, despite
 * arriving as `"3000.00"`), never here in the model.
 *
 * `dateAjout` IS A FULL ISO DATETIME, NOT `Y-M-D` — a genuine divergence from
 * `Manager.dateDebut`/`Commercial.dateDebut`. Verified from source: `show()`
 * reads the `date_ajouter` compatibility accessor, itself a bare passthrough of
 * `date_ajout` (cast `datetime` on the model), with NO `->format('Y-m-d')`
 * reformatting the way `indexManagers`'/`indexCommercials`' own transforms both
 * apply. Render through `formatDateTime`, not `formatDate`.
 *
 * `adresse` IS NULLABLE, despite `StoreAgentRequest`-equivalent validation
 * requiring it (`'adresse' => 'required|string|max:255'` in `store()`) — the
 * schema itself (`create_agent_table.php:16`) has no `->nullable(false)`
 * override, so a validator requiring a field at creation does not guarantee the
 * column stays non-null forever (the exact BC-U class of trap `num_abonnement`/
 * `ville` already taught this codebase, on `Manager`). Modelled nullable here on
 * schema evidence, not assumed non-null from the validator's own `required`.
 *
 * `manager` (present only on a commercial's own response) IS REDUCED TO
 * `{id, nom, prenom}` AT THE MAPPER BOUNDARY. The raw wire value is the FULL
 * nested raw Agent object of the manager (recursively the same shape `show()`
 * emits for anyone) — modelling that recursively would be exactly the
 * speculation ADR-0008 forbids; this screen only ever displays who a
 * commercial's manager is, the same reduction `Client.agentName` already
 * established for a different relation.
 */

export const AGENT_STATUSES = ["active", "blocked", "inactive"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/**
 * Domain-owned labels/tones — its OWN copy, not imported from `Manager`'s or
 * `Commercial`'s own identical-looking maps (ADR-0012). Same three values,
 * same tone assignments, verified independently against this domain's own
 * `AgentStatus` enum.
 */
export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  active: "Active",
  blocked: "Blocked",
  inactive: "Inactive",
};

export const AGENT_STATUS_TONES: Record<AgentStatus, StatusTone> = {
  active: "success",
  blocked: "danger",
  inactive: "muted",
};

/** A commercial's manager, reduced to what the workspace displays — see the module docblock. */
export type AgentManagerSummary = {
  id: number;
  nom: string;
  prenom: string;
};

/** Fields present on every Agent response, regardless of role. */
type AgentCommon = {
  id: number;
  nom: string;
  prenom: string;
  status: AgentStatus;
  /** NOT NULL, unique (`create_agent_table.php:17`). */
  numCin: string;
  /** NULLABLE, unique (`create_agent_table.php:18`). */
  numIce: string | null;
  /** NULLABLE (`create_agent_table.php:34`) — same trap `Manager.numAbonnement` already documents. */
  numAbonnement: string | null;
  /** NOT NULL, unique (`create_agent_table.php:42`). */
  numCompte: string;
  /** NULLABLE (`create_agent_table.php:15`). */
  ville: string | null;
  /** NULLABLE — see the module docblock; the validator's `required` at `store()` does not prove this. */
  adresse: string | null;
  /** A FULL ISO DATETIME, not `Y-M-D` — see the module docblock. Render through `formatDateTime`. */
  dateAjout: string | null;
  photoUrl: string | null;
  photoCinRectoUrl: string | null;
  photoCinVersoUrl: string | null;
  carteAutoEntrepreneurUrl: string | null;
  certificatHabitatUrl: string | null;
  ficheAntroprometriqueUrl: string | null;
  ficheIncidentBancaireUrl: string | null;
  /** `decimal:2`-cast STRING (e.g. `"3000.00"`), validated `integer` server-side. Never null — DB default `0`. */
  salaire: string;
  /** `decimal:2`-cast STRING, validated `numeric` server-side (genuinely decimal, unlike the other three). Never null — DB default `0`. */
  montantEssence: string;
  /** `decimal:2`-cast STRING, validated `integer` server-side. Never null — DB default `0`. */
  montantDeclarationCnss: string;
  /** `decimal:2`-cast STRING, validated `integer` server-side. Never null — DB default `0`. */
  chargeAutoEntrepreneur: string;
};

export type ManagerAgent = AgentCommon & {
  role: "manager";
  /** NULLABLE (`create_agent_table.php:41`). Always null for a commercial — see the module docblock. */
  villeSousResponsabilite: string | null;
};

export type CommercialAgent = AgentCommon & {
  role: "commercial";
  /** NULLABLE (`create_agent_table.php:39`). Always null for a manager — see the module docblock. */
  villeActuelle: string | null;
  /** NULLABLE (`create_agent_table.php:40`). Always null for a manager. */
  secteur: string | null;
  /** `null` when `manager_id` is unset. Reduced from the full nested raw Agent — see the module docblock. */
  manager: AgentManagerSummary | null;
};

export type Agent = ManagerAgent | CommercialAgent;

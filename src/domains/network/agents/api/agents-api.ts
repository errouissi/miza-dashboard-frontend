import { httpClient } from "@/infrastructure/http";
import type { Agent, AgentManagerSummary, AgentStatus } from "../model/agent";

/**
 * The Agent endpoints and their mappers (FTA §7, D-6).
 *
 *   show     { success, role, agent: <raw Agent model + appended *_url fields
 *              (+ moto if present) + manager (raw nested Agent, commercial
 *              only), *_path fields stripped> }   GET
 *   update   { success, message, data: <agent> }                    POST
 *              (NOT PUT — `routes/api.php` registers this literally as
 *              `Route::post('/{id}', ...)`, mirroring `Manager`'s/
 *              `Commercial`'s own update calls)
 *   block    { success, message, data: <agent> }                    PUT
 *   activate { success, message, data: <agent> }                    PUT
 *
 * `role` at the TOP LEVEL is the discriminator this mapper reads — `agent.role`
 * carries the identical value (verified from source, `AgentController::show`),
 * so either would work; the top-level one is used because it is the field the
 * controller clearly intends as the discriminator.
 */

/** The manager relation exactly as the raw wire nests it — a full raw Agent, reduced at the mapper boundary (see `model/agent.ts`). */
type RawManagerRelation = {
  id: number;
  nom: string;
  prenom: string;
};

/**
 * The wire row this mapper actually reads — a NARROW slice of `show()`'s full
 * raw-model payload (ADR-0008: model only what a screen reads). The real
 * response carries `moto` and both Laravel timestamps too; neither is typed
 * here because nothing in this domain renders them (Moto stays a separate,
 * explicitly deferred scope — M7 Phase 1.5 discovery, D1).
 */
type AgentRow = {
  id: number;
  nom: string;
  prenom: string;
  status: AgentStatus;
  num_cin: string;
  num_ice: string | null;
  num_abonnement: string | null;
  num_compte: string;
  ville: string | null;
  adresse: string | null;
  /** The `date_ajouter` compatibility accessor — a bare passthrough of `date_ajout`, no reformatting. Full ISO datetime. */
  date_ajouter: string | null;
  photo_url: string | null;
  photo_cin_recto_url: string | null;
  photo_cin_verso_url: string | null;
  carte_auto_entrepreneur_url: string | null;
  certificat_habitat_url: string | null;
  fiche_antroprometrique_url: string | null;
  fiche_incident_bancaire_url: string | null;
  /** `decimal:2`-cast STRING, `integer`-validated server-side. Never null (DB default 0). */
  salaire: string;
  /** `decimal:2`-cast STRING, `numeric`-validated server-side. Never null (DB default 0). */
  montant_essence: string;
  /** `decimal:2`-cast STRING, `integer`-validated server-side. Never null (DB default 0). */
  montant_declaration_cnss: string;
  /** `decimal:2`-cast STRING, `integer`-validated server-side. Never null (DB default 0). */
  charge_auto_entrepreneur: string;
  // Manager-only on the wire (always null for a commercial):
  ville_sous_responsabilite: string | null;
  // Commercial-only on the wire (always null for a manager):
  ville_actuelle: string | null;
  secteur: string | null;
  manager: RawManagerRelation | null;
};

type ShowAgentEnvelope = {
  success: boolean;
  role: "manager" | "commercial";
  agent: AgentRow;
};

function toManagerSummary(raw: RawManagerRelation | null): AgentManagerSummary | null {
  if (!raw) return null;
  return { id: raw.id, nom: raw.nom, prenom: raw.prenom };
}

function toAgent(role: "manager" | "commercial", row: AgentRow): Agent {
  const common = {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    status: row.status,
    numCin: row.num_cin,
    numIce: row.num_ice,
    numAbonnement: row.num_abonnement,
    numCompte: row.num_compte,
    ville: row.ville,
    adresse: row.adresse,
    dateAjout: row.date_ajouter,
    photoUrl: row.photo_url,
    photoCinRectoUrl: row.photo_cin_recto_url,
    photoCinVersoUrl: row.photo_cin_verso_url,
    carteAutoEntrepreneurUrl: row.carte_auto_entrepreneur_url,
    certificatHabitatUrl: row.certificat_habitat_url,
    ficheAntroprometriqueUrl: row.fiche_antroprometrique_url,
    ficheIncidentBancaireUrl: row.fiche_incident_bancaire_url,
    salaire: row.salaire,
    montantEssence: row.montant_essence,
    montantDeclarationCnss: row.montant_declaration_cnss,
    chargeAutoEntrepreneur: row.charge_auto_entrepreneur,
  };

  if (role === "manager") {
    return {
      ...common,
      role: "manager",
      villeSousResponsabilite: row.ville_sous_responsabilite,
    };
  }

  return {
    ...common,
    role: "commercial",
    villeActuelle: row.ville_actuelle,
    secteur: row.secteur,
    manager: toManagerSummary(row.manager),
  };
}

export async function fetchAgent(id: number): Promise<Agent> {
  const { data } = await httpClient.get<ShowAgentEnvelope>(`/admin/agents/${id}`);
  return toAgent(data.role, data.agent);
}

/**
 * Blocks an account. 400s if it is ALREADY blocked — the same endpoint
 * `Manager`'s/`Commercial`'s own `blockManager`/`blockCommercial` call, hit
 * again here rather than imported (both are private to their own domains;
 * see ADR-0012 and the M7 Phase 1 discovery pass for why this is a fresh,
 * parallel implementation, not a workaround).
 */
export async function blockAgent(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/block`);
}

/** Activates an account. 400s if it is ALREADY active — same reasoning as above. */
export async function activateAgent(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/activate`);
}

/**
 * `GET /admin/agents/{agent}/stock-quantity` (`access-dashboard`) — added in
 * backend commit `5302f99` specifically to power the Agent Edit Zero-stock
 * reassignment guard (M7 Agent 360 completion item), widened in backend
 * commit `f9a6fe4` to also carry `available_grattage`, widened again in
 * backend commit `15aa704` to also carry `stock`, the product-level
 * breakdown. Commercial-only: verified from source
 * (`AgentController::stockQuantity`) that a manager id 404s, matching the
 * `stock()` endpoint's own convention.
 *
 * `{ stock_quantity: <int>, available_grattage: <decimal string>, stock:
 * <array> }` — no `success`/`data` envelope, no pagination. `stock_quantity`
 * and `stock` are both derived from ONE `listOwnerStock('agent', ...)` call
 * (verified from source, commit `15aa704`) — the backend does not query
 * twice, and this client does not either. `stock_quantity` reuses
 * `StockService::listOwnerStock('agent', ...)->sum('quantity')` verbatim —
 * the EXACT same definition the backend's own `update()` reassignment guard
 * re-checks atomically at save time. `stock` uses the IDENTICAL row shape
 * as `GET /admin/managers/{manager}/stock` (`product_id`, `name`,
 * `operator`, `value`, `available_quantity`) — already filtered server-side
 * to `quantity > 0`, so a zero-quantity product never appears here, exactly
 * matching that endpoint's own established contract (see
 * `manager-stock-api.ts`'s `ManagerStockItem`, whose row shape this
 * structurally matches — reused at the presentation layer via
 * `StockProductTable` in `agent-stock-panel.tsx`, not re-imported here, to
 * keep this domain's own api/model layer self-contained). `available_grattage`
 * reuses `StockService::commercialAvailableGrattage()` verbatim — verified
 * from source (backend commit `f9a6fe4`) that `validateTransfer()`'s own
 * STEP 7b capacity gate now calls this SAME extracted method on the locked
 * commercial row; this read calls it on an unlocked instance. All three
 * fields are ALWAYS present together (the controller method has no
 * conditional branch producing one without another) — never optional here.
 * `available_grattage` is a bcmath decimal string, scale 2, NEVER a float,
 * and NEVER negative (floored at 0 server-side) — kept as a string end to
 * end, never parsed to a number, matching every other money-shaped field
 * in this codebase. `stock[].value` stays the Product model's native
 * INTEGER cast (verified from source, commit `15aa704`) — never a decimal
 * string, matching `ManagerStockItem.value`'s own type exactly.
 *
 * ALL THREE FIELDS ARE INFORMATIONAL ONLY, per the backend's own docblock: a
 * proactive UI hint, never the authorization/capacity check itself. The
 * zero-stock reassignment guard's own authority remains `update()`'s
 * locked transaction; a Transfer's capacity authority remains
 * `validateTransfer()`'s own locked STEP 7b — this read must never be
 * used to derive, recompute, or substitute for either. `stock` is never
 * summed client-side to reconstruct `stock_quantity` — the two are read
 * as the backend returns them, independently.
 */
type StockRow = {
  product_id: number;
  name: string;
  operator: string;
  value: number;
  available_quantity: number;
};

type StockQuantityEnvelope = {
  stock_quantity: number;
  available_grattage: string;
  stock: StockRow[];
};

/**
 * Structurally identical to `ManagerStockItem`
 * (`stock/agent-transfers/api/manager-stock-api.ts`) — a real,
 * source-verified, shared wire contract, not a coincidence (backend commit
 * `15aa704`'s own docblock: "IDENTICAL representation as Manager/Company
 * stock"). Declared locally rather than importing that domain's type here
 * so this domain's api/model layer stays self-contained; TypeScript's
 * structural typing lets a `CommercialStockItem[]` satisfy a
 * `ManagerStockItem[]`-typed prop without any runtime coupling — see
 * `StockProductTable` in `agent-stock-panel.tsx`, the actual reuse point.
 */
export type CommercialStockItem = {
  productId: number;
  name: string;
  operator: string;
  value: number;
  availableQuantity: number;
};

export type CommercialStockSnapshot = {
  stockQuantity: number;
  /** Decimal string, scale 2 — never parsed to a number. See module docblock. */
  availableGrattage: string;
  /** Already filtered to quantity > 0 server-side — never re-filtered here. */
  stock: CommercialStockItem[];
};

export async function fetchCommercialStockSnapshot(
  agentId: number,
): Promise<CommercialStockSnapshot> {
  const { data } = await httpClient.get<StockQuantityEnvelope>(
    `/admin/agents/${agentId}/stock-quantity`,
  );
  return {
    stockQuantity: data.stock_quantity,
    availableGrattage: data.available_grattage,
    stock: data.stock.map((row) => ({
      productId: row.product_id,
      name: row.name,
      operator: row.operator,
      value: row.value,
      availableQuantity: row.available_quantity,
    })),
  };
}

/**
 * The Agent Edit field set (M7 Phase 1.5, widened M7 Agent 360 completion
 * item), verified field-by-field against `AgentController::update()`'s own
 * validator — NOT every field the validator accepts (`status`, every Moto
 * field, and the legacy `num_de_compte`/`date_ajouter`/`mdp` aliases are
 * all real, technically-writable inputs this form deliberately never
 * sends; see the M7 Phase 1.5 discovery pass for why each is excluded).
 *
 * `manager_id` (COMMERCIAL ONLY) WAS EXCLUDED THROUGH M7 PHASE 1.5 (D2),
 * ON A CONTRADICTION NOW RESOLVED: the frozen architecture names the
 * "Zero-stock reassignment guard" — reassigning a commercial's manager
 * while they hold stock — as this exact form's own responsibility. Backend
 * commit `5302f99` closed the one real blocker (no authoritative Commercial
 * stock read existed) by adding `GET /admin/agents/{agent}/stock-quantity`
 * and hardening `manager_id`'s own eligibility (`role=manager AND
 * status=active`, `Rule::exists`) and atomicity (lock+check+write in one
 * transaction). See `AgentEditDrawer`'s own docblock for the UI-side guard.
 *
 * `numIce` HAS A REAL, DISCLOSED BACKEND LIMITATION: the validator is
 * `sometimes|required|string|max:255|unique:...` — combining `sometimes`
 * with `required` means an EMPTY-STRING clear attempt is rejected (422,
 * or in practice today a 500 — see below), even though the column itself
 * is nullable. There is no way to clear it through this endpoint. This
 * form does not attempt to route around that; its own zod schema requires
 * a non-empty value for the identical reason `numAbonnement` is
 * client-side-required on `ManagerFormSheet`/`CommercialFormSheet` despite
 * being nullable server-side.
 */
export type UpdateAgentCommonInput = {
  nom: string;
  prenom: string;
  ville: string;
  adresse: string;
  numCin: string;
  numIce: string;
  /** Wire name `num_d_abonnement` — the API's own spelling, unrelated to the `num_abonnement` column name it maps to. */
  numAbonnement: string;
  /** A whole-number string (`integer`-validated server-side) — never re-derive this as a decimal. */
  salaire: string;
  /** A decimal-allowed string (`numeric`-validated server-side) — the one exception among the four HR/expense fields. */
  montantEssence: string;
  /** A whole-number string (`integer`-validated server-side). */
  montantDeclarationCnss: string;
  /** A whole-number string (`integer`-validated server-side). */
  chargeAutoEntrepreneur: string;
};

export type UpdateAgentInput =
  | (UpdateAgentCommonInput & { role: "manager"; villeSousResponsabilite: string })
  | (UpdateAgentCommonInput & {
      role: "commercial";
      villeActuelle: string;
      secteur: string;
      /**
       * ALWAYS SENT for a commercial, whether interactively changed or not —
       * the same "text fields always sent" convention every other field
       * here already follows. Re-sending the CURRENT manager id is a
       * verified no-op server-side (`update()`'s guard only triggers when
       * the value actually differs from `agent.manager_id`), so this never
       * risks an unwanted reassignment attempt merely because the field was
       * disabled or untouched.
       */
      managerId: number;
    });

/**
 * `undefined`/absent = "not selected, leave the existing file untouched" —
 * the same meaning `FileUploadField`'s own `value: null` reports once the
 * operator has not chosen a replacement. NEVER a `string` (a URL): a
 * replacement is either a real, locally-selected `File`, or nothing is
 * sent at all — see `FileUploadField`'s own module docblock for why a
 * remote URL is never turned into a `File`.
 */
export type UpdateAgentFiles = {
  photo?: File | null;
  photoCinRecto?: File | null;
  photoCinVerso?: File | null;
  certificatDHabitat?: File | null;
  carteAutoEntrepreneur?: File | null;
  ficheAntroprometrique?: File | null;
  ficheDIncidentBanquaire?: File | null;
};

/**
 * Builds the multipart payload — mirrors `agent-onboarding-api.ts`'s own
 * `buildFormData` PATTERN (append only what applies), a fresh implementation
 * rather than a shared helper: `store()`'s payload is a create-shape (every
 * common field required, five mandatory files) and this one is an
 * update-shape (every common field always sent since the form always seeds
 * from a real record, every file OMITTED unless genuinely replaced) — two
 * different contracts that happen to share a request-building style, not
 * one contract with two callers.
 *
 * TEXT FIELDS ARE ALWAYS SENT, never conditionally — the form is always
 * seeded from the current `Agent`, so every value is already known and
 * "unchanged" is indistinguishable from "changed back to the same value";
 * sending all of them is simpler and matches `updateManager`'s/
 * `updateCommercial`'s own existing convention exactly.
 *
 * FILES ARE SENT ONLY WHEN A NEW `File` WAS ACTUALLY SELECTED — appending
 * nothing preserves the backend's existing file (`AgentController::update`'s
 * own `if ($request->hasFile(...))` guard, verified from source). There is
 * no way to express "remove this file" (the backend has no such capability)
 * and this function does not invent one.
 */
function buildUpdateFormData(input: UpdateAgentInput, files: UpdateAgentFiles): FormData {
  const formData = new FormData();

  formData.append("nom", input.nom.trim());
  formData.append("prenom", input.prenom.trim());
  formData.append("ville", input.ville.trim());
  formData.append("adresse", input.adresse.trim());
  formData.append("num_cin", input.numCin.trim());
  formData.append("num_ice", input.numIce.trim());
  formData.append("num_d_abonnement", input.numAbonnement.trim());
  formData.append("salaire", input.salaire.trim());
  formData.append("montant_essence", input.montantEssence.trim());
  formData.append("montant_declaration_cnss", input.montantDeclarationCnss.trim());
  formData.append("charge_auto_entrepreneur", input.chargeAutoEntrepreneur.trim());

  if (input.role === "manager") {
    formData.append("ville_sous_responsabilite", input.villeSousResponsabilite.trim());
  } else {
    formData.append("ville_actuelle", input.villeActuelle.trim());
    formData.append("secteur", input.secteur.trim());
    formData.append("manager_id", String(input.managerId));
  }

  if (files.photo) formData.append("photo", files.photo);
  if (files.photoCinRecto) formData.append("photo_cin_recto", files.photoCinRecto);
  if (files.photoCinVerso) formData.append("photo_cin_verso", files.photoCinVerso);
  if (files.certificatDHabitat) {
    formData.append("certificat_d_habitat", files.certificatDHabitat);
  }
  if (files.carteAutoEntrepreneur) {
    formData.append("carte_auto_entrepreneur", files.carteAutoEntrepreneur);
  }
  if (files.ficheAntroprometrique) {
    formData.append("fiche_antroprometrique", files.ficheAntroprometrique);
  }
  if (files.ficheDIncidentBanquaire) {
    formData.append("fiche_d_incident_banquaire", files.ficheDIncidentBanquaire);
  }

  return formData;
}

export async function updateAgent(
  id: number,
  input: UpdateAgentInput,
  files: UpdateAgentFiles = {},
): Promise<void> {
  await httpClient.post(`/admin/agents/${id}`, buildUpdateFormData(input, files));
}

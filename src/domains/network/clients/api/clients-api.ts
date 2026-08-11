import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import type {
  Client,
  ClientDetail,
  ClientDetailCommercial,
  ClientListParams,
  ClientStatus,
} from "../model/client";

/**
 * The Clients endpoints and their mappers (FTA §7, D-6).
 *
 * THE SAME FLAT-PAGINATOR ENVELOPE AS MANAGERS/COMMERCIALS — verified live
 * against the running backend, not assumed from resemblance:
 * `{success, data: {data: [...], current_page, per_page, total, last_page}}`.
 * `fromLaravelPage` is still not reused, for the same reason as the Agent
 * domains: it reads `envelope.meta`, which this shape does not have.
 *
 *   index         { success, data: { data: [...], current_page, per_page, total, last_page } }
 *   update         { success, data: <the whole client model> }                PUT (a normal REST verb — no POST-not-PUT oddity here)
 *   toggle status  { success, message, data: <client> }                       PATCH
 *
 * UNLIKE THE AGENT DOMAINS, `index()` RUNS NO `transform()` — the row below
 * is the raw `Client` model serialization (`$hidden`/`$appends` applied, but
 * nothing hand-picked). `ClientRow` therefore models only the wire keys this
 * screen actually reads; everything else riding along on the real response
 * (`agent_id`, `latitude`, `longitude`, `location_updated_at`,
 * `last_login_at`, `otp_expires_at`, `otp_verified_at`, `updated_at`,
 * `dept_to_commercial`) is deliberately absent from this type (ADR-0008) —
 * TypeScript never sees them, and nothing here reads them.
 */

/** The nested agent relation, eager-loaded with a restricted column list (`id,nom,prenom,num_compte`). `null` when the client has no assigned agent. */
type ClientAgentRow = {
  id: number;
  nom: string;
  prenom: string;
  num_compte: string;
};

/** The wire row — wire keys are NOT column names (`Client::$hidden`/`$appends`). */
type ClientRow = {
  id: number;
  phone: string;
  status: ClientStatus;
  /** Nullable (`clients.ville` is `nullable()`) — aliases the hidden `ville` column. */
  ville_comercial: string | null;
  /**
   * Nullable, identical shape to `ville_comercial` — added for Client 360's
   * Edit reuse (M7 Phase 1). Present on the wire since M3.4 (no
   * `select()`/`transform()` restricts `index()`'s row); newly mapped here
   * because `ClientFormSheet` (shared by this list and the Client 360
   * workspace) now reads it.
   */
  secteur_comercial: string | null;
  /** `decimal:2` cast, serialized as a string. Has a DB default (`0`) — never null. */
  solde: string;
  agent: ClientAgentRow | null;
  /** Full ISO-8601, or null. */
  created_at: string | null;
  // `agent_id`, `dept_to_commercial`, `latitude`, `longitude`,
  // `location_updated_at`, `last_login_at`, `otp_expires_at`,
  // `otp_verified_at`, `updated_at` are present on the wire and intentionally
  // unmapped (ADR-0008) — see the module docblock.
};

/** The flat-paginator envelope this endpoint returns. */
type ClientsEnvelope = {
  success: boolean;
  data: {
    data: ClientRow[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    phone: row.phone,
    status: row.status,
    ville: row.ville_comercial,
    secteur: row.secteur_comercial,
    // Carried across verbatim — see model/client.ts for why.
    solde: row.solde,
    // Reduced to a display string here, at the mapper boundary — this
    // screen never seeds a picker or edits the assignment, so nothing past
    // "who, if anyone" is worth carrying past this point.
    agentName: row.agent ? `${row.agent.prenom} ${row.agent.nom}` : null,
    dateDebut: row.created_at,
  };
}

export async function fetchClients(params: ClientListParams): Promise<Paginated<Client>> {
  const { data } = await httpClient.get<ClientsEnvelope>("/admin/clients", {
    params: {
      page: params.page,
      per_page: params.perPage,
      // Every optional filter is OMITTED rather than sent empty — index()
      // gates each one on `$request->filled()`, so an empty string is
      // ignored there too; sending it would just make the URL lie about
      // what is being filtered.
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.assigned ? { assigned: params.assigned } : {}),
      ...(params.ville ? { ville_comercial: params.ville } : {}),
      // No `sort`, no `date_from`/`date_to`: the endpoint accepts none of them.
    },
  });

  const page = data.data;
  return {
    items: page.data.map(toClient),
    page: page.current_page,
    perPage: page.per_page,
    total: page.total,
    lastPage: page.last_page,
  };
}

/**
 * `GET /admin/clients/{id}` (`ClientController::show`, `view-clients`) —
 * Client 360 (M7 Phase 1). `show()` eager-loads a FULL, unrestricted `agent`
 * relation (unlike `index()`'s restricted `id,nom,prenom,num_compte`
 * projection) — `ClientDetailAgentRow` models only the columns
 * `ClientDetailCommercial` actually carries (ADR-0008), not every column
 * `show()`'s nested agent brings along.
 */
type ClientDetailAgentRow = {
  id: number;
  nom: string;
  prenom: string;
  num_compte: string;
};

/**
 * The `show()` wire row. Same `$hidden`/`$appends` aliasing as `ClientRow`
 * (`ville_comercial`/`secteur_comercial`, not the hidden `ville`/`secteur`
 * columns) — everything else `show()`'s raw serialization carries (`solde`,
 * `dept_to_commercial`, `latitude`/`longitude`/`location_updated_at`,
 * `last_login_at`, `otp_*`, `updated_at`) is deliberately unmapped
 * (ADR-0008) — see `model/client.ts`'s `ClientDetail` docblock for why.
 */
type ClientDetailRow = {
  id: number;
  phone: string;
  status: ClientStatus;
  ville_comercial: string | null;
  secteur_comercial: string | null;
  created_at: string | null;
  agent: ClientDetailAgentRow | null;
};

type ClientDetailEnvelope = {
  success: boolean;
  data: ClientDetailRow;
};

function toCommercial(row: ClientDetailAgentRow | null): ClientDetailCommercial | null {
  if (!row) return null;
  return { id: row.id, nom: row.nom, prenom: row.prenom, numCompte: row.num_compte };
}

function toClientDetail(row: ClientDetailRow): ClientDetail {
  return {
    id: row.id,
    phone: row.phone,
    status: row.status,
    ville: row.ville_comercial,
    secteur: row.secteur_comercial,
    createdAt: row.created_at,
    commercial: toCommercial(row.agent),
  };
}

/**
 * `Client::findOrFail($id)` sits inside a bare `catch (\Exception)` with no
 * `ModelNotFoundException` carve-out (confirmed from source, the same
 * pre-existing gap `clients-list-page.tsx`'s own docblock already
 * discloses for `show`/`update`/`toggleStatus`) — a nonexistent client id
 * 500s here, not 404s. `httpClient`'s own error normalization still
 * classifies that 500 as `kind: "unknown"`, so `ClientWorkspacePage`'s
 * not-found branch is reached only via a malformed `:id` route param
 * (never constructed by this app's own navigation), not a genuine 404 from
 * the backend — see the page's own docblock.
 */
export async function fetchClientById(id: number): Promise<ClientDetail> {
  const { data } = await httpClient.get<ClientDetailEnvelope>(`/admin/clients/${id}`);
  return toClientDetail(data.data);
}

/**
 * The fields this screen may edit: `phone`, `ville_comercial` and
 * `secteur_comercial` (M7 Phase 1 — `secteur` widened the original
 * `phone`/`ville` pair, using the SAME city-scoped Secteurs mechanism the
 * agent-onboarding wizard's Identity step already established, not a second
 * implementation).
 *
 * DELIBERATELY NARROWER THAN THE VALIDATOR, the same reasoning as every
 * prior domain. `ClientController::update` also accepts `status` (excluded
 * on purpose — it is `sometimes|in:active,blocked`, deliberately NOT
 * `pending`, so a generic edit can never silently approve a self-registered
 * client; that is the status action's job, not a form field), `agent_id` is
 * NOT EVEN IN THIS VALIDATOR (confirmed from source — Commercial
 * assignment/reassignment is a dedicated workflow, `assign`/`reassign`/
 * `assignBulk`/`unassign`, never `update()`; Client 360 Phase 2's own
 * concern, not Edit's), and paired `latitude`/`longitude` (map features,
 * out of scope for this milestone).
 *
 * `ville`/`secteur` ARE REQUIRED HERE (`min(1)` in the zod schema) even
 * though BOTH are NULLABLE ON READ — the same BC-U-class gap as Managers'
 * `ville`. Neither validator (`'ville_comercial' => 'sometimes|string'`,
 * `'secteur_comercial' => 'sometimes|string'`) has `nullable` — an empty
 * string is converted to `null` by Laravel's global
 * `ConvertEmptyStringsToNull` middleware and then rejected by `string`
 * (confirmed identical to Managers'/Commercials' BC-U). Requiring a
 * non-empty value client-side keeps this gap unreachable through the UI; it
 * does not fix it.
 */
export type UpdateClientInput = {
  phone: string;
  ville: string;
  secteur: string;
};

export async function updateClient(id: number, input: UpdateClientInput): Promise<void> {
  // PUT — `routes/api.php` registers this as `Route::put('/{id}', ...)`, a
  // normal REST verb (unlike the Agent domains' POST-not-PUT oddity).
  await httpClient.put(`/admin/clients/${id}`, {
    phone: input.phone,
    ville_comercial: input.ville,
    secteur_comercial: input.secteur,
  });
}

/** The bulk-assign input. `agentId` must resolve to an active commercial server-side. */
export type AssignClientsBulkInput = {
  agentId: number;
  clientIds: number[];
};

/**
 * Bulk-reassigns many clients to one active commercial in a single request
 * (`ClientController::assignBulk`, `PATCH /admin/clients/assign-bulk`) — up
 * to 100 ids per call (validator: `client_ids` `array|min:1|max:100`), and
 * genuinely all-or-nothing: the update runs inside `DB::transaction` after
 * validation, so there is no partial-success case to render.
 *
 * UPDATES `agent_id` ONLY. Unlike the legacy single-client `POST /{id}/assign`
 * (`Client::assignToAgent`, which also rewrites `ville`/`secteur` to match the
 * new agent), this endpoint's own route comment says so explicitly:
 * "Admin-only bulk reassignment (PATCH; updates agent_id only)" — confirmed
 * from source, not assumed. A client bulk-assigned to a commercial in a
 * different city keeps its existing city/sector until edited separately —
 * `client-bulk-assign-sheet.tsx`'s copy says this plainly.
 *
 * ERROR SHAPE, verified from source, NOT assumed from every other Clients
 * endpoint: `assignBulk` is the FIRST Clients action that correctly catches
 * `ValidationException` before its generic handler, so a malformed
 * `agent_id`/`client_ids` shape returns a real field-mapped 422 (BC-N does
 * NOT apply here). The business-rule rejection ("agent_id must reference an
 * active commercial", "Some clients do not exist") is a SEPARATE, hand-rolled
 * `{success:false, message}` 422 with no `errors` key and no `code` — it
 * normalizes to `kind: "unknown"`, not `"validation"` or `"domain"`. That gap
 * is handled as a generic mutation failure in `client-bulk-assign-sheet.tsx`,
 * not worked around here or matched by message string.
 */
export async function assignClientsBulk(input: AssignClientsBulkInput): Promise<void> {
  await httpClient.patch("/admin/clients/assign-bulk", {
    agent_id: input.agentId,
    client_ids: input.clientIds,
  });
}

/**
 * Flips `active ↔ blocked`, and sends a `pending` client to `active`
 * (`Client::toggleStatus()`: `$this->status === 'active' ? 'blocked' :
 * 'active'` — `'pending' !== 'active'`, so the else-branch fires). This is
 * the ONLY status-changing endpoint for clients — there is no separate
 * block/activate pair the way the Agent domains have. See
 * `client-status-dialog.tsx` for how the single action is labelled
 * correctly for all three starting states.
 */
export async function toggleClientStatus(id: number): Promise<void> {
  await httpClient.patch(`/admin/clients/${id}/status`);
}

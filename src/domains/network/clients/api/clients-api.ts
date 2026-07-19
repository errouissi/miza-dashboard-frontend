import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import type { Client, ClientListParams, ClientStatus } from "../model/client";

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
  /** `decimal:2` cast, serialized as a string. Has a DB default (`0`) — never null. */
  solde: string;
  agent: ClientAgentRow | null;
  /** Full ISO-8601, or null. */
  created_at: string | null;
  // `agent_id`, `secteur_comercial`, `dept_to_commercial`, `latitude`,
  // `longitude`, `location_updated_at`, `last_login_at`, `otp_expires_at`,
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
 * The fields this screen may edit: `phone` and `ville_comercial` only.
 *
 * DELIBERATELY NARROWER THAN THE VALIDATOR, the same reasoning as every
 * prior domain. `ClientController::update` also accepts `status` (excluded
 * on purpose — it is `sometimes|in:active,blocked`, deliberately NOT
 * `pending`, so a generic edit can never silently approve a self-registered
 * client; that is the status action's job, not a form field) and paired
 * `latitude`/`longitude` (map features, out of scope for this milestone).
 *
 * `ville` IS REQUIRED HERE (`min(1)` in the zod schema) even though it is
 * NULLABLE ON READ — the same BC-U-class gap as Managers' `ville`. The
 * validator is `'ville_comercial' => 'sometimes|string'`, with NO
 * `nullable` — an empty string is converted to `null` by Laravel's global
 * `ConvertEmptyStringsToNull` middleware and then rejected by `string`
 * (confirmed identical to Managers'/Commercials' BC-U, a third instance).
 * Requiring a non-empty value client-side keeps this gap unreachable through
 * the UI; it does not fix it.
 */
export type UpdateClientInput = {
  phone: string;
  ville: string;
};

export async function updateClient(id: number, input: UpdateClientInput): Promise<void> {
  // PUT — `routes/api.php` registers this as `Route::put('/{id}', ...)`, a
  // normal REST verb (unlike the Agent domains' POST-not-PUT oddity).
  await httpClient.put(`/admin/clients/${id}`, {
    phone: input.phone,
    ville_comercial: input.ville,
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

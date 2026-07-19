import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import type {
  Commercial,
  CommercialListParams,
  CommercialStatus,
} from "../model/commercial";

/**
 * The Commercials endpoints and their mappers (FTA §7, D-6).
 *
 * THE SAME FLAT-PAGINATOR ENVELOPE AS MANAGERS — verified independently
 * against the live endpoint, not assumed from resemblance:
 * `{success, data: {data: [...], current_page, per_page, total, last_page}}`.
 * `fromLaravelPage` is still not reused here, for the same reason it wasn't
 * for Managers: it reads `envelope.meta`, which this shape does not have.
 *
 *   index    { success, data: { data: [...], current_page, per_page, total, last_page } }
 *   update   { success, message, data: <the whole agent model> }   POST, not PUT
 *   block    { success, message, data: <agent> }                   PUT
 *   activate { success, message, data: <agent> }                   PUT
 */

/** The transformed row — wire keys, which are NOT the column names. */
type CommercialRow = {
  id: number;
  nom: string;
  prenom: string;
  status: CommercialStatus;
  /** Nullable (`agents.num_abonnement` is `nullable()`) — confirmed against live data. */
  num_abonnement: string | null;
  num_de_compte: string;
  /** `bcadd` output: a preformatted 2dp decimal STRING, never a number. */
  avance_total: string;
  /** Nullable (`agents.ville_actuelle` is `nullable()`) — confirmed against live data. */
  ville_actuelle: string | null;
  /** Concatenated "{nom} {prenom}" display string, or null — never a relation object. */
  manager: string | null;
  /** `Y-M-D` or null. */
  date_debut: string | null;
  /** An absolute URL despite the name — the controller assigns `photo_url` here. */
  photo_path: string | null;
  // `app_version` is present on every row and intentionally unmapped (ADR-0008).
  // `secteur` is NOT present: the transform never includes it, though the
  // filter accepts one (deferred by decision — see model/commercial.ts).
};

/** The flat-paginator envelope this endpoint returns. */
type CommercialsEnvelope = {
  success: boolean;
  data: {
    data: CommercialRow[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

function toCommercial(row: CommercialRow): Commercial {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    status: row.status,
    numAbonnement: row.num_abonnement,
    numDeCompte: row.num_de_compte,
    // Carried across verbatim — see model/commercial.ts for why.
    avanceTotal: row.avance_total,
    villeActuelle: row.ville_actuelle,
    manager: row.manager,
    dateDebut: row.date_debut,
    photoUrl: row.photo_path,
  };
}

export async function fetchCommercials(
  params: CommercialListParams,
): Promise<Paginated<Commercial>> {
  const { data } = await httpClient.get<CommercialsEnvelope>(
    "/admin/agents/commercials",
    {
      params: {
        page: params.page,
        per_page: params.perPage,
        // Every optional filter is OMITTED rather than sent empty — indexCommercials
        // gates each one on `$request->filled()`, so an empty string is ignored
        // there too; sending it would just make the URL lie about what is filtered.
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.villeActuelle ? { ville_actuelle: params.villeActuelle } : {}),
        ...(params.managerId ? { manager_id: Number(params.managerId) } : {}),
        ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
        ...(params.dateTo ? { date_to: params.dateTo } : {}),
        // No `sort` or `direction`: the endpoint accepts neither (BC-L).
      },
    },
  );

  const page = data.data;
  return {
    items: page.data.map(toCommercial),
    page: page.current_page,
    perPage: page.per_page,
    total: page.total,
    lastPage: page.last_page,
  };
}

/**
 * The fields this screen may edit.
 *
 * DELIBERATELY NARROWER THAN THE VALIDATOR — the same reasoning as Managers.
 * `AgentController::update` also accepts `adresse`, `num_cin`, `num_ice`,
 * `salaire`, the CNSS/auto-entrepreneur charges and every document upload, but
 * `indexCommercials` returns none of them, so this screen cannot seed them.
 *
 * `secteur` IS accepted by the validator (`sometimes|nullable|string|max:255`)
 * but is absent here too, for the same reason: the row never carries it, so
 * the drawer could only render it blank — and a blank value that saves is how
 * a real one gets overwritten with nothing.
 *
 * `manager_id` IS accepted by the validator and IS properly nullable there —
 * unlike `ville`/`num_d_abonnement` (BC-U) — but is not offered here. The row
 * has no manager id to seed a picker's selection with (only a display
 * string), and reassignment carries a guarded business rule
 * (`COMMERCIAL_HAS_STOCK_CANNOT_REASSIGN` — blocked while the commercial holds
 * grattage stock). That is the Agent Transfers feature, not a field on this form.
 *
 * `status` is absent on purpose too: it is owned by the block/activate actions.
 */
export type UpdateCommercialInput = {
  nom: string;
  prenom: string;
  /** Nullable server-side; sent as an empty string to clear it. */
  villeActuelle: string;
  numAbonnement: string;
};

export async function updateCommercial(
  id: number,
  input: UpdateCommercialInput,
): Promise<void> {
  // POST, not PUT — same route registration as Managers' update.
  //
  // `num_d_abonnement` is the API's spelling; the controller's own keyMapping
  // translates it to the `num_abonnement` column. `ville_actuelle` carries NO
  // such mapping (verified from source) — sent as-is.
  await httpClient.post(`/admin/agents/${id}`, {
    nom: input.nom,
    prenom: input.prenom,
    ville_actuelle: input.villeActuelle,
    num_d_abonnement: input.numAbonnement,
  });
}

/**
 * Blocks an account. 400s if it is ALREADY blocked, which is why the caller offers
 * this action only when the status is not `blocked`.
 */
export async function blockCommercial(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/block`);
}

/** Activates an account. 400s if it is ALREADY active — same reasoning as above. */
export async function activateCommercial(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/activate`);
}

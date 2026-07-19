import { httpClient } from "@/infrastructure/http";
import type { Paginated } from "@/infrastructure/http";
import type { Manager, ManagerListParams, ManagerStatus } from "../model/manager";

/**
 * The Managers endpoints and their mappers (FTA §7, D-6).
 *
 * A FIFTH DISTINCT ENVELOPE. Villes/Bons use `{data, links, meta}`; Admins' index
 * is a raw array; this one is `{success, data: <paginator>}` — the paginator
 * SERIALIZED FLAT, so the rows are at `data.data` and the page metadata sits
 * beside them rather than under a `meta` key.
 *
 *   index    { success, data: { data: [...], current_page, per_page, total, last_page } }
 *   update   { success, message, data: <the whole agent model> }   POST, not PUT
 *   block    { success, message, data: <agent> }                   PUT
 *   activate { success, message, data: <agent> }                   PUT
 *
 * `fromLaravelPage` is NOT reused here: it reads `envelope.meta`, which this shape
 * does not have. Bending it to accept both would put a second backend's
 * inconsistency into shared infrastructure, which is precisely what the
 * per-resource anti-corruption layer exists to prevent.
 */

/** The transformed row — wire keys, which are NOT the column names. */
type ManagerRow = {
  id: number;
  nom: string;
  prenom: string;
  status: ManagerStatus;
  num_abonnement: string;
  num_de_compte: string;
  /** `bcadd` output: a preformatted 2dp decimal STRING, never a number. */
  avance_total: string;
  ville: string;
  ville_sous_responsabilite: string | null;
  nombre_commerciaux: number;
  /** `Y-M-D` or null. */
  date_debut: string | null;
  /** An absolute URL despite the name — the controller assigns `photo_url` here. */
  photo_path: string | null;
  // `app_version` is present on every row and intentionally unmapped (ADR-0008).
  // `commercials` is NOT present: the eager load is discarded by the transform (BC-Q).
};

/** The flat-paginator envelope this endpoint returns. */
type ManagersEnvelope = {
  success: boolean;
  data: {
    data: ManagerRow[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
};

function toManager(row: ManagerRow): Manager {
  return {
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    status: row.status,
    numAbonnement: row.num_abonnement,
    numDeCompte: row.num_de_compte,
    // Carried across verbatim. Parsing this into a number would take a value the
    // backend computed with bcadd and route it through binary floating point.
    avanceTotal: row.avance_total,
    ville: row.ville,
    villeSousResponsabilite: row.ville_sous_responsabilite,
    nombreCommerciaux: row.nombre_commerciaux,
    dateDebut: row.date_debut,
    photoUrl: row.photo_path,
  };
}

export async function fetchManagers(
  params: ManagerListParams,
): Promise<Paginated<Manager>> {
  const { data } = await httpClient.get<ManagersEnvelope>("/admin/agents/managers", {
    params: {
      page: params.page,
      per_page: params.perPage,
      // Every optional filter is OMITTED rather than sent empty. The backend gates
      // each one on `$request->filled()`, so an empty string is ignored there too —
      // sending it would just make the URL lie about what is being filtered.
      ...(params.search ? { search: params.search } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.ville ? { ville: params.ville } : {}),
      ...(params.villeSousResponsabilite
        ? { ville_sous_responsabilite: params.villeSousResponsabilite }
        : {}),
      ...(params.dateFrom ? { date_from: params.dateFrom } : {}),
      ...(params.dateTo ? { date_to: params.dateTo } : {}),
      // No `sort` or `direction`: the endpoint accepts neither (BC-L).
    },
  });

  const page = data.data;
  return {
    items: page.data.map(toManager),
    page: page.current_page,
    perPage: page.per_page,
    total: page.total,
    lastPage: page.last_page,
  };
}

/**
 * The fields this screen may edit.
 *
 * DELIBERATELY NARROWER THAN THE VALIDATOR. `AgentController::update` accepts a
 * great deal more — `adresse`, `num_cin`, `num_ice`, `salaire`, the CNSS and
 * auto-entrepreneur charges, every document upload — but the LIST endpoint does not
 * return any of them, so this screen cannot seed them. Offering an input the drawer
 * would have to render blank is how a save silently overwrites a real value with an
 * empty one. Those fields belong to the deferred detail page (ADR-0014), which will
 * read `GET /admin/agents/{identifier}` and have the values to seed.
 *
 * `status` is absent on purpose too: it is owned by the block/activate actions,
 * which map to their own endpoints and their own permissions.
 *
 * COMMERCIAL-ONLY FIELDS ARE NEVER SENT. `manager_id`, `ville_actuelle` and
 * `secteur` are nulled out for managers by `store()` and have no meaning here.
 */
export type UpdateManagerInput = {
  nom: string;
  prenom: string;
  ville: string;
  /** Nullable server-side; sent as an empty string to clear it. */
  villeSousResponsabilite: string;
  numAbonnement: string;
};

export async function updateManager(
  id: number,
  input: UpdateManagerInput,
): Promise<void> {
  // POST, not PUT — `routes/api.php` registers the update as
  // `Route::post('/{id}', …)`. A PUT here would 405.
  //
  // `num_d_abonnement` is the API's spelling; the controller's own keyMapping
  // translates it to the `num_abonnement` column. Sending the column name directly
  // would bypass that mapping and be silently dropped.
  await httpClient.post(`/admin/agents/${id}`, {
    nom: input.nom,
    prenom: input.prenom,
    ville: input.ville,
    ville_sous_responsabilite: input.villeSousResponsabilite,
    num_d_abonnement: input.numAbonnement,
  });
}

/**
 * Blocks an account. 400s if it is ALREADY blocked, which is why the caller offers
 * this action only when the status is not `blocked`.
 */
export async function blockManager(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/block`);
}

/** Activates an account. 400s if it is ALREADY active — same reasoning as above. */
export async function activateManager(id: number): Promise<void> {
  await httpClient.put(`/admin/agents/${id}/activate`);
}

/**
 * A secteur — reference data, belonging to exactly one ville.
 *
 * `villeId` only. The endpoint returns the foreign key and nothing else (backend
 * `Secteur` model: `$fillable = ['nom_secteur','ville_id']`, `$timestamps = false`,
 * no eager-loaded relation), so there is no ville NAME on the wire. Names are
 * resolved through the Villes public surface — this domain never stores them.
 */
export type Secteur = {
  id: number;
  nomSecteur: string;
  villeId: number;
};

/**
 * The list query surface — one optional filter, because that is the whole of what
 * `SecteurController::index` accepts (`$request->filled('ville_id')`).
 *
 * There is deliberately no `page`, `perPage`, `search`, `sort` or `direction`: the
 * endpoint returns `$query->get()`, an unpaginated array. Modelling parameters the
 * API ignores would invite a UI that appears to filter and does not.
 */
export type SecteurListParams = {
  villeId?: number;
};

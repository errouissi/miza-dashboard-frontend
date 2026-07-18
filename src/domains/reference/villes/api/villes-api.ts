import { fromLaravelPage, httpClient } from "@/infrastructure/http";
import type { LaravelPageEnvelope, Paginated } from "@/infrastructure/http";
import {
  MAX_PER_PAGE,
  VILLE_LIST_DEFAULTS,
  type Ville,
  type VilleListParams,
} from "../model/ville";

/**
 * The Villes endpoints and their mappers (FTA §7, D-6).
 *
 * THE WRITE ENDPOINTS DO NOT SHARE AN ENVELOPE, and this module is where that
 * stops being everyone else's problem:
 *
 *   index    {data, links, meta}                    <- standard collection
 *   store    {id, nom_ville}                        <- the raw model, status 201
 *   update   {status, message, data: {...}}         <- a third shape
 *   destroy  {message}                              <- a fourth
 *
 * Every one of them is mapped here into the domain's own `Ville`. Nothing above
 * this file knows the backend has four opinions about envelopes.
 */

type VilleRow = {
  id: number;
  nom_ville: string;
};

function toVille(row: VilleRow): Ville {
  return { id: row.id, nomVille: row.nom_ville };
}

export async function fetchVilles(params: VilleListParams): Promise<Paginated<Ville>> {
  const { data } = await httpClient.get<LaravelPageEnvelope<VilleRow>>("/admin/villes", {
    params: {
      page: params.page,
      per_page: params.perPage,
      // Omitted rather than sent empty: `search` is `sometimes|string`, and an
      // empty string is a filter that matches everything the long way round.
      ...(params.search ? { search: params.search } : {}),
      sort: params.sort,
      direction: params.direction,
    },
  });

  return fromLaravelPage(data, toVille);
}

/**
 * The full ville set, for relation pickers in other reference domains.
 *
 * Requests `per_page` at the backend's documented maximum (`IndexVilleRequest`:
 * `max:100`) — asking for more is a 422, not a larger page. The endpoint offers
 * no unpaginated variant, so this returns the first 100 villes ordered by name.
 */
export async function fetchVilleOptions(): Promise<Ville[]> {
  const page = await fetchVilles({
    ...VILLE_LIST_DEFAULTS,
    perPage: MAX_PER_PAGE,
  });
  return page.items;
}

export async function createVille(nomVille: string): Promise<Ville> {
  // 201, and the body is the bare model — no envelope to unwrap.
  const { data } = await httpClient.post<VilleRow>("/admin/villes", {
    nom_ville: nomVille,
  });
  return toVille(data);
}

export async function updateVille(id: number, nomVille: string): Promise<Ville> {
  // This one DOES wrap, under `data`, alongside `status`/`message`.
  const { data } = await httpClient.put<{ data: VilleRow }>(`/admin/villes/${id}`, {
    nom_ville: nomVille,
  });
  return toVille(data.data);
}

export async function deleteVille(id: number): Promise<void> {
  // Returns `{message}` only; there is nothing worth surfacing to the caller.
  await httpClient.delete(`/admin/villes/${id}`);
}

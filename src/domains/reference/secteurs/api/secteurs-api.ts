import { httpClient } from "@/infrastructure/http";
import type { Secteur, SecteurListParams } from "../model/secteur";

/**
 * The Secteurs endpoints and their mappers (FTA §7, D-6).
 *
 * THE LIST IS AN ARRAY, NOT A PAGE. `SecteurController::index` ends in
 * `$query->get()` — no envelope, no `meta`, no pagination. This module returns
 * `Secteur[]` and does not pretend otherwise: wrapping it in `Paginated<T>` would
 * manufacture a page shape the server never sent, and the UI above would render
 * controls the API cannot honour.
 *
 * The write endpoints diverge exactly as Villes' do:
 *   store    {id, nom_secteur, ville_id}                 <- raw model, 201
 *   update   {status, message, data: {...}}              <- wrapped
 *   destroy  {message}                                   <- message only
 */

type SecteurRow = {
  id: number;
  nom_secteur: string;
  ville_id: number;
};

function toSecteur(row: SecteurRow): Secteur {
  return { id: row.id, nomSecteur: row.nom_secteur, villeId: row.ville_id };
}

export async function fetchSecteurs(params: SecteurListParams): Promise<Secteur[]> {
  const { data } = await httpClient.get<SecteurRow[]>("/admin/secteurs", {
    // `ville_id` is read via `filled()`, so an absent filter must be absent from
    // the query string — not sent empty.
    params: params.villeId !== undefined ? { ville_id: params.villeId } : undefined,
  });

  return data.map(toSecteur);
}

export type SecteurInput = {
  nomSecteur: string;
  villeId: number;
};

export async function createSecteur(input: SecteurInput): Promise<Secteur> {
  const { data } = await httpClient.post<SecteurRow>("/admin/secteurs", {
    nom_secteur: input.nomSecteur,
    ville_id: input.villeId,
  });
  return toSecteur(data);
}

export async function updateSecteur(id: number, input: SecteurInput): Promise<Secteur> {
  const { data } = await httpClient.put<{ data: SecteurRow }>(`/admin/secteurs/${id}`, {
    nom_secteur: input.nomSecteur,
    // `ville_id` is `required` on update too, not just create — the backend
    // re-validates the whole record, so it must be resent even when unchanged.
    ville_id: input.villeId,
  });
  return toSecteur(data.data);
}

export async function deleteSecteur(id: number): Promise<void> {
  await httpClient.delete(`/admin/secteurs/${id}`);
}

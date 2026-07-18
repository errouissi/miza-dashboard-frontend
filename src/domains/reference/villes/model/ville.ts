/**
 * A ville — reference data, and the whole row.
 *
 * The table has exactly two columns and no timestamps (backend `Ville` model:
 * `$timestamps = false`), so there is no `createdAt` to sort or display, and no
 * richer detail shape hiding behind the list. Do not add fields speculatively.
 */
export type Ville = {
  id: number;
  nomVille: string;
};

/** Sort columns the backend actually accepts (`IndexVilleRequest`: an enum, not a free column). */
export const VILLE_SORTS = ["nom_ville", "id"] as const;
export type VilleSort = (typeof VILLE_SORTS)[number];

export type SortDirection = "asc" | "desc";

/** The list query, mirroring the documented `GET /admin/villes` query surface. */
export type VilleListParams = {
  page: number;
  perPage: number;
  search: string;
  sort: VilleSort;
  direction: SortDirection;
};

/**
 * Backend defaults, restated so the frontend's "unset" and the server's "unset"
 * agree. `nom_ville ASC` is NOT `created_at DESC` like the other admin lists —
 * villes has no timestamps to order by.
 */
export const VILLE_LIST_DEFAULTS: VilleListParams = {
  page: 1,
  perPage: 15,
  search: "",
  sort: "nom_ville",
  direction: "asc",
};

/** `per_page` is capped server-side (`max:100`) and in Design System §14. */
export const MAX_PER_PAGE = 100;

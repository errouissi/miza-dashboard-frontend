import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { VilleFormSheet } from "../components/ville-form-sheet";
import { DeleteVilleDialog } from "../components/delete-ville-dialog";
import { useVillesQuery } from "../queries/villes-queries";
import {
  MAX_PER_PAGE,
  VILLE_LIST_DEFAULTS,
  VILLE_SORTS,
  type SortDirection,
  type Ville,
  type VilleListParams,
  type VilleSort,
} from "../model/ville";

/**
 * The Villes list (roadmap M1, the walking skeleton's resource).
 *
 * WRITTEN DIRECTLY, not through a generator or a shared ListPage — deliberately.
 * The shared DataTable/FilterBar/ListPage patterns are extracted in M2 from THREE
 * working screens, so that their API is evidence rather than a guess (FTA §12,
 * roadmap M2). Duplication is the cheaper mistake here.
 *
 * FILTER STATE LIVES IN THE URL (FTA §9, Design System §15): every filtered view
 * is shareable and bookmarkable, and back/forward and refresh-survival come free.
 * Reading params out of the query string is done here rather than through a shared
 * typed hook — one caller does not justify the abstraction yet.
 */
function readParams(search: URLSearchParams): VilleListParams {
  const rawPage = Number(search.get("page"));
  const rawPerPage = Number(search.get("per_page"));
  const rawSort = search.get("sort");
  const rawDirection = search.get("direction");

  // Every value is re-validated. The query string is user-controlled: an
  // out-of-range per_page is a 422 from the server, and an un-whitelisted sort
  // is rejected by IndexVilleRequest's enum — neither should leave this page.
  return {
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : VILLE_LIST_DEFAULTS.page,
    perPage:
      Number.isInteger(rawPerPage) && rawPerPage >= 1 && rawPerPage <= MAX_PER_PAGE
        ? rawPerPage
        : VILLE_LIST_DEFAULTS.perPage,
    search: search.get("search") ?? VILLE_LIST_DEFAULTS.search,
    sort: VILLE_SORTS.includes(rawSort as VilleSort)
      ? (rawSort as VilleSort)
      : VILLE_LIST_DEFAULTS.sort,
    direction:
      rawDirection === "asc" || rawDirection === "desc"
        ? (rawDirection as SortDirection)
        : VILLE_LIST_DEFAULTS.direction,
  };
}

export function VillesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const villesQuery = useVillesQuery(params);
  const { has } = usePermission();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Ville | undefined>(undefined);
  const [deleting, setDeleting] = useState<Ville | undefined>(undefined);

  // Every villes action resolves to the same coarse backend permission — see the
  // registry. Kept as one named value so the call sites read as intent, and so
  // splitting it when the backend gains granular permissions is a local change.
  const canManage = has(PERMISSIONS.ACCESS_DASHBOARD);

  const patchParams = (patch: Partial<VilleListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    // Defaults are omitted from the URL: "/villes" beats "/villes?page=1&…" for a
    // view the operator has not actually filtered.
    if (next.page !== VILLE_LIST_DEFAULTS.page) query.set("page", String(next.page));
    if (next.perPage !== VILLE_LIST_DEFAULTS.perPage)
      query.set("per_page", String(next.perPage));
    if (next.search) query.set("search", next.search);
    if (next.sort !== VILLE_LIST_DEFAULTS.sort) query.set("sort", next.sort);
    if (next.direction !== VILLE_LIST_DEFAULTS.direction)
      query.set("direction", next.direction);

    setSearchParams(query, { replace: true });
  };

  const toggleSort = (column: VilleSort) => {
    const direction: SortDirection =
      params.sort === column && params.direction === "asc" ? "desc" : "asc";
    // Sorting returns to page 1 — staying on page 7 of a re-sorted list shows
    // rows that have nothing to do with what was just clicked.
    patchParams({ sort: column, direction, page: 1 });
  };

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (ville: Ville) => {
    setEditing(ville);
    setFormOpen(true);
  };

  const page = villesQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Cities</h1>
        {canManage ? <Button onClick={openCreate}>New city</Button> : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          aria-label="Search cities"
          placeholder="Search cities…"
          className="max-w-xs"
          defaultValue={params.search}
          // Searching resets to page 1: the result set changed, so the old page
          // number refers to a list that no longer exists.
          onChange={(event) => patchParams({ search: event.target.value, page: 1 })}
        />
      </div>

      {villesQuery.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : villesQuery.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-12">
          <p className="text-sm">The list of cities could not be loaded.</p>
          <Button variant="outline" onClick={() => void villesQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : page && page.items.length === 0 ? (
        <p className="text-muted-foreground py-12 text-sm">
          {params.search ? "No city matches this search." : "No city yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="p-2 font-medium">
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => toggleSort("nom_ville")}
                    aria-sort={
                      params.sort === "nom_ville"
                        ? params.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    Name
                  </button>
                </th>
                <th scope="col" className="w-40 p-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {page?.items.map((ville) => (
                <tr key={ville.id} className="border-b">
                  <td className="p-2">{ville.nomVille}</td>
                  <td className="p-2">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(ville)}
                          aria-label={`Edit ${ville.nomVille}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleting(ville)}
                          aria-label={`Delete ${ville.nomVille}`}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page && page.lastPage > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Page {page.page} of {page.lastPage} · {page.total} cities
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.page <= 1}
              onClick={() => patchParams({ page: page.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page.page >= page.lastPage}
              onClick={() => patchParams({ page: page.page + 1 })}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      <VilleFormSheet open={formOpen} onOpenChange={setFormOpen} ville={editing} />
      <DeleteVilleDialog
        ville={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
      />
    </div>
  );
}

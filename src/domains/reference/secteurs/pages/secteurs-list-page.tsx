import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { useVilleOptionsQuery } from "@/domains/reference/villes";
import { usePermission } from "@/shared/hooks";
import { ABSENT } from "@/shared/formatters";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { SecteurFormSheet } from "../components/secteur-form-sheet";
import { DeleteSecteurDialog } from "../components/delete-secteur-dialog";
import { useSecteursQuery } from "../queries/secteurs-queries";
import type { Secteur, SecteurListParams } from "../model/secteur";

/**
 * The Secteurs list (roadmap M2a).
 *
 * WRITTEN BY COPYING VILLES, and deliberately not abstracted. The shared
 * ListPage/DataTable/FilterBar/FormDrawer patterns are extracted in M2c, from
 * three working screens — two uses do not justify promotion (FTA §12). The
 * duplication here is the milestone's method, not an oversight.
 *
 * IT EXPOSES ONLY WHAT THE ENDPOINT SUPPORTS. `SecteurController::index` returns
 * `$query->get()` with a single optional `ville_id` filter: no pagination, no
 * search, no sorting. So there is no search box, no sortable header and no pager
 * on this screen. Rendering those controls over an API that ignores them — or
 * faking them client-side over a full-table fetch — would misrepresent the
 * system and hide the gap instead of surfacing it.
 *
 * The one filter it does have lives in the URL (FTA §9), exactly as Villes' do.
 */
const VILLE_PARAM = "ville_id";

function readParams(search: URLSearchParams): SecteurListParams {
  const raw = Number(search.get(VILLE_PARAM));
  // Re-validated: the query string is user-controlled, and a non-numeric filter
  // must not reach the API.
  return Number.isInteger(raw) && raw > 0 ? { villeId: raw } : {};
}

export function SecteursListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);

  const secteursQuery = useSecteursQuery(params);
  // The ONLY ville read in this domain. It feeds both the filter/picker options
  // and the relation column below — one query, one cache entry (villesKeys.options).
  const villesQuery = useVilleOptionsQuery();
  const villes = villesQuery.data ?? [];

  const { has } = usePermission();
  const canManage = has(PERMISSIONS.ACCESS_DASHBOARD);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Secteur | undefined>(undefined);
  const [deleting, setDeleting] = useState<Secteur | undefined>(undefined);

  const setVilleFilter = (villeId: number | undefined) => {
    const query = new URLSearchParams();
    if (villeId !== undefined) query.set(VILLE_PARAM, String(villeId));
    setSearchParams(query, { replace: true });
  };

  // Derived at render from the villes query — never stored, never copied into
  // state. A ville outside the picker set (see the per_page bound on the Villes
  // options query) renders as absent rather than as a bare id.
  const villeNameOf = (villeId: number): string =>
    villes.find((ville) => ville.id === villeId)?.nomVille ?? ABSENT;

  const listErrorReference = isAppError(secteursQuery.error)
    ? resolveErrorDisplay(secteursQuery.error).requestId
    : undefined;

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (secteur: Secteur) => {
    setEditing(secteur);
    setFormOpen(true);
  };

  const secteurs = secteursQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Sectors</h1>
        {canManage ? <Button onClick={openCreate}>New sector</Button> : null}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="villeFilter" className="text-sm font-medium">
          City
        </label>
        <select
          id="villeFilter"
          aria-label="Filter by city"
          className="border-input h-9 max-w-xs rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          value={params.villeId ?? ""}
          onChange={(event) =>
            setVilleFilter(event.target.value ? Number(event.target.value) : undefined)
          }
        >
          <option value="">All cities</option>
          {villes.map((ville) => (
            <option key={ville.id} value={ville.id}>
              {ville.nomVille}
            </option>
          ))}
        </select>
      </div>

      {secteursQuery.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : secteursQuery.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-12">
          <p className="text-sm">The list of sectors could not be loaded.</p>
          {listErrorReference ? (
            <p className="text-muted-foreground font-mono text-xs">
              Ref. {listErrorReference}
            </p>
          ) : null}
          <Button variant="outline" onClick={() => void secteursQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : secteurs && secteurs.length === 0 ? (
        <p className="text-muted-foreground py-12 text-sm">
          {params.villeId !== undefined ? "No sector in this city." : "No sector yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {/* Plain headers: the endpoint accepts no `sort`, so a clickable
                    header would promise an ordering it cannot deliver. */}
                <th scope="col" className="p-2 font-medium">
                  Name
                </th>
                <th scope="col" className="p-2 font-medium">
                  City
                </th>
                <th scope="col" className="w-40 p-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {secteurs?.map((secteur) => (
                <tr key={secteur.id} className="border-b">
                  <td className="p-2">{secteur.nomSecteur}</td>
                  <td className="text-muted-foreground p-2">
                    {villeNameOf(secteur.villeId)}
                  </td>
                  <td className="p-2">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(secteur)}
                          aria-label={`Edit ${secteur.nomSecteur}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleting(secteur)}
                          aria-label={`Delete ${secteur.nomSecteur}`}
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

      <SecteurFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        secteur={editing}
        villes={villes}
      />
      <DeleteSecteurDialog
        secteur={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
      />
    </div>
  );
}

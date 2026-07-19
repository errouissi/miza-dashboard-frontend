import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { ABSENT, formatDate } from "@/shared/formatters";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { ListPage } from "@/shared/components/patterns/list-page";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { ManagerFormSheet } from "../components/manager-form-sheet";
import { ManagerStatusDialog } from "../components/manager-status-dialog";
import { ManagerVilleFilter } from "../components/manager-ville-filter";
import { useManagersQuery } from "../queries/managers-queries";
import {
  MANAGER_LIST_DEFAULTS,
  MANAGER_STATUSES,
  MANAGER_STATUS_LABELS,
  MAX_PER_PAGE,
  type Manager,
  type ManagerListParams,
  type ManagerStatus,
} from "../model/manager";

/**
 * The Managers list (roadmap M3.2) — the second Network domain, and the first
 * genuinely paginated resource since Villes.
 *
 * WRITTEN BY COPYING ADMINS AND VILLES, and deliberately not abstracted. Managers
 * is only the SECOND paginated resource and the FIRST with a real status enum, so
 * `DataTable`, `FilterBar`, `StatusBadge` and `MoneyAmount` all remain unextracted
 * — ADR-0006 requires three genuinely comparable cases and this is not the third.
 *
 * IT EXPOSES ONLY WHAT THE ENDPOINT SUPPORTS (ADR-0009):
 *   - pagination and search: YES, both are real backend parameters
 *   - sorting: NO. `indexManagers` accepts no sort parameter of any kind and
 *     hardcodes `date_ajout DESC` (BC-L). There are no sortable headers here, and
 *     adding one would invent a capability the API does not have.
 *   - a detail page: NOT IN THIS MILESTONE (ADR-0014). No row links anywhere.
 *
 * KNOWN BACKEND BEHAVIOUR THIS SCREEN DOES NOT PAPER OVER:
 *   - SEARCH IS CASE-SENSITIVE (BC-O). The backend uses `LIKE` on PostgreSQL, so
 *     "casa" does not match "Casablanca". The placeholder says so rather than
 *     lower-casing the term client-side, which would silently change which rows
 *     the server returns and hide the defect.
 *   - `date_to` EXCLUDES ITS OWN DAY (BC-P), because the backend compares a
 *     datetime column against midnight. The field is labelled accordingly. Adding
 *     a day client-side would send a date the operator did not choose.
 *   - INVALID FILTERS RETURN 500, NOT 422 (BC-N). Every control here is bounded —
 *     an enum select, a date input, a per_page the operator cannot type — so the
 *     condition is unreachable through the UI. The error state is NOT dressed up
 *     as a validation error if it happens anyway.
 */

/** URL parameter names. The backend's spelling, so a shared link is self-describing. */
const PARAM = {
  page: "page",
  perPage: "per_page",
  search: "search",
  status: "status",
  ville: "ville",
  villeSousResponsabilite: "ville_sous_responsabilite",
  dateFrom: "date_from",
  dateTo: "date_to",
} as const;

/**
 * Reads and RE-VALIDATES the query string (FTA §9, Design System §15).
 *
 * Every value is checked because the query string is user-controlled and the
 * backend answers an out-of-range `per_page` or an unknown `status` with a 500
 * rather than a 422 (BC-N). Rejecting them here means that path is never taken —
 * not because the frontend is pretending the backend is well-behaved, but because
 * a hostile URL should not reach the API in the first place.
 */
function readParams(search: URLSearchParams): ManagerListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawPerPage = Number(search.get(PARAM.perPage));
  const rawStatus = search.get(PARAM.status);

  return {
    page:
      Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : MANAGER_LIST_DEFAULTS.page,
    perPage:
      Number.isInteger(rawPerPage) && rawPerPage >= 1 && rawPerPage <= MAX_PER_PAGE
        ? rawPerPage
        : MANAGER_LIST_DEFAULTS.perPage,
    search: search.get(PARAM.search) ?? MANAGER_LIST_DEFAULTS.search,
    status: MANAGER_STATUSES.includes(rawStatus as ManagerStatus)
      ? (rawStatus as ManagerStatus)
      : MANAGER_LIST_DEFAULTS.status,
    ville: search.get(PARAM.ville) ?? MANAGER_LIST_DEFAULTS.ville,
    villeSousResponsabilite:
      search.get(PARAM.villeSousResponsabilite) ??
      MANAGER_LIST_DEFAULTS.villeSousResponsabilite,
    dateFrom: search.get(PARAM.dateFrom) ?? MANAGER_LIST_DEFAULTS.dateFrom,
    dateTo: search.get(PARAM.dateTo) ?? MANAGER_LIST_DEFAULTS.dateTo,
  };
}

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function ManagersListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const managersQuery = useManagersQuery(params);
  const { has } = usePermission();

  /**
   * Each action mirrors ONE server-side check. `view-agents` gates the route and
   * therefore the list itself; these gate the actions inside it.
   *
   * There is no create gate here: agent creation is the M3.6 wizard, not this
   * screen. There is no delete gate either — `destroy` is a soft block identical
   * to `block`, so exposing it would be two buttons for one outcome (BC-R).
   */
  const canUpdate = has(PERMISSIONS.UPDATE_AGENT);
  const canBlock = has(PERMISSIONS.BLOCK_AGENT);
  const canActivate = has(PERMISSIONS.ACTIVATE_AGENT);
  const hasAnyRowAction = canUpdate || canBlock || canActivate;

  /**
   * The city filter is gated on `access-dashboard` because that is what guards
   * `GET /admin/villes`, the endpoint backing its options. An operator holding
   * `view-agents` alone may legitimately read THIS list but would 403 on the villes
   * request — the same shape as the B-6 catalogue in Admins (ADR-0010). The control
   * lives in its own component so the query mounts only when it may succeed; see
   * `manager-ville-filter.tsx` for why a select rather than a text box.
   */
  const canReadVilles = has(PERMISSIONS.ACCESS_DASHBOARD);

  const [editing, setEditing] = useState<Manager | undefined>(undefined);
  const [blocking, setBlocking] = useState<Manager | undefined>(undefined);
  const [activating, setActivating] = useState<Manager | undefined>(undefined);

  const patchParams = (patch: Partial<ManagerListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    // Defaults are omitted, so an unfiltered view has a clean URL.
    if (next.page !== MANAGER_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.perPage !== MANAGER_LIST_DEFAULTS.perPage)
      query.set(PARAM.perPage, String(next.perPage));
    if (next.search) query.set(PARAM.search, next.search);
    if (next.status) query.set(PARAM.status, next.status);
    if (next.ville) query.set(PARAM.ville, next.ville);
    if (next.villeSousResponsabilite)
      query.set(PARAM.villeSousResponsabilite, next.villeSousResponsabilite);
    if (next.dateFrom) query.set(PARAM.dateFrom, next.dateFrom);
    if (next.dateTo) query.set(PARAM.dateTo, next.dateTo);

    setSearchParams(query, { replace: true });
  };

  /**
   * Any filter change returns to page 1. The result set changed, so the old page
   * number refers to a list that no longer exists.
   */
  const filterBy = (patch: Partial<ManagerListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = managersQuery.data;

  const listErrorReference = isAppError(managersQuery.error)
    ? resolveErrorDisplay(managersQuery.error).requestId
    : undefined;

  const isFiltered =
    !!params.search ||
    !!params.status ||
    !!params.ville ||
    !!params.villeSousResponsabilite ||
    !!params.dateFrom ||
    !!params.dateTo;

  return (
    <ListPage
      title="Managers"
      // No create action: agent onboarding is the M3.6 wizard (5 mandatory file
      // uploads), not a drawer this screen can open.
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="managerSearch" className="text-sm font-medium">
              Search
            </label>
            <Input
              id="managerSearch"
              aria-label="Search managers"
              // The backend uses LIKE on PostgreSQL — case-sensitive (BC-O). Said
              // plainly rather than silently normalising the term.
              placeholder="Name, account or subscription (case-sensitive)"
              className="w-72"
              defaultValue={params.search}
              onChange={(event) => filterBy({ search: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="managerStatus" className="text-sm font-medium">
              Status
            </label>
            <select
              id="managerStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as ManagerStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {MANAGER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {MANAGER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {canReadVilles ? (
            <ManagerVilleFilter
              value={params.ville}
              onChange={(ville) => filterBy({ ville })}
            />
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="managerArea" className="text-sm font-medium">
              Area of responsibility
            </label>
            <Input
              id="managerArea"
              aria-label="Filter by area of responsibility"
              // This one IS a partial match server-side (`like %…%`), unlike ville.
              placeholder="Partial match"
              className="w-56"
              defaultValue={params.villeSousResponsabilite}
              onChange={(event) =>
                filterBy({ villeSousResponsabilite: event.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="managerDateFrom" className="text-sm font-medium">
              Joined from
            </label>
            <Input
              id="managerDateFrom"
              type="date"
              aria-label="Joined from"
              className="w-44"
              value={params.dateFrom}
              onChange={(event) => filterBy({ dateFrom: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="managerDateTo" className="text-sm font-medium">
              Joined before
            </label>
            <Input
              id="managerDateTo"
              type="date"
              // Labelled "before", not "to": the backend compares a datetime column
              // against midnight, so this date's own day is EXCLUDED (BC-P).
              aria-label="Joined before"
              className="w-44"
              value={params.dateTo}
              onChange={(event) => filterBy({ dateTo: event.target.value })}
            />
          </div>
        </div>
      }
      footer={
        page && page.lastPage > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {page.page} of {page.lastPage} · {page.total} managers
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
        ) : null
      }
    >
      {/* The page description. ListPage owns title and spacing only — it takes no
          description prop, and adding one would modify a shared pattern for a
          single caller. Rendered domain-locally instead. */}
      <p className="text-muted-foreground -mt-2 text-sm">
        Managers own a team of commercials. Ordered by join date, most recent first.
      </p>

      {managersQuery.isPending ? (
        <ListLoadingState />
      ) : managersQuery.isError ? (
        <ListErrorState
          message="The list of managers could not be loaded."
          reference={listErrorReference}
          onRetry={() => void managersQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No manager matches these filters." : "No manager yet."}
        </ListEmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {/* Plain headers throughout: the endpoint accepts no sort (BC-L). */}
                <th scope="col" className="p-2 font-medium">
                  Manager
                </th>
                <th scope="col" className="p-2 font-medium">
                  Subscription
                </th>
                <th scope="col" className="p-2 font-medium">
                  Status
                </th>
                <th scope="col" className="p-2 font-medium">
                  City
                </th>
                <th scope="col" className="p-2 font-medium">
                  Area
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Commercials
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Total advance
                </th>
                <th scope="col" className="p-2 font-medium">
                  Joined
                </th>
                <th scope="col" className="w-56 p-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {page?.items.map((manager) => {
                const fullName = `${manager.prenom} ${manager.nom}`;
                return (
                  <tr key={manager.id} className="border-b">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Avatar>
                          {/* An absolute URL despite the wire key `photo_path`. */}
                          {manager.photoUrl ? (
                            <AvatarImage src={manager.photoUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {manager.prenom.slice(0, 1)}
                            {manager.nom.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span>{fullName}</span>
                          <span className="text-muted-foreground text-xs">
                            {manager.numDeCompte}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground p-2">{manager.numAbonnement}</td>
                    <td className="p-2">
                      {/* A three-value enum, labelled locally. First StatusBadge
                          evidence, but only the first — no shared badge (ADR-0006). */}
                      <span
                        className={
                          manager.status === "active"
                            ? "text-sm"
                            : "text-muted-foreground text-sm"
                        }
                      >
                        {MANAGER_STATUS_LABELS[manager.status]}
                      </span>
                    </td>
                    <td className="p-2">{manager.ville}</td>
                    <td className="p-2">{manager.villeSousResponsabilite ?? ABSENT}</td>
                    <td className="p-2 text-right tabular-nums">
                      {manager.nombreCommerciaux}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {/* Rendered verbatim: the backend already formatted it to 2dp
                          with bcadd. Parsing it to a number to re-format would put a
                          money value through binary floating point for nothing. */}
                      {manager.avanceTotal}
                    </td>
                    <td className="p-2">{formatDate(manager.dateDebut)}</td>
                    <td className="p-2">
                      {hasAnyRowAction ? (
                        <div className="flex justify-end gap-2">
                          {canUpdate ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing(manager)}
                              aria-label={`Edit ${fullName}`}
                            >
                              Edit
                            </Button>
                          ) : null}
                          {/* The backend 400s on a no-op, so each action is offered
                              only where it would actually change something. An
                              `inactive` account can receive either. */}
                          {canBlock && manager.status !== "blocked" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBlocking(manager)}
                              aria-label={`Block ${fullName}`}
                            >
                              Block
                            </Button>
                          ) : null}
                          {canActivate && manager.status !== "active" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActivating(manager)}
                              aria-label={`Activate ${fullName}`}
                            >
                              Activate
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ManagerFormSheet
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        manager={editing}
      />
      <ManagerStatusDialog
        manager={blocking}
        action="block"
        onOpenChange={(open) => {
          if (!open) setBlocking(undefined);
        }}
      />
      <ManagerStatusDialog
        manager={activating}
        action="activate"
        onOpenChange={(open) => {
          if (!open) setActivating(undefined);
        }}
      />
    </ListPage>
  );
}

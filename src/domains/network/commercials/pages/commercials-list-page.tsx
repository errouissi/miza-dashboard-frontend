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
import { CommercialFormSheet } from "../components/commercial-form-sheet";
import { CommercialStatusDialog } from "../components/commercial-status-dialog";
import { CommercialVilleFilter } from "../components/commercial-ville-filter";
import { CommercialManagerFilter } from "../components/commercial-manager-filter";
import { useCommercialsQuery } from "../queries/commercials-queries";
import {
  COMMERCIAL_LIST_DEFAULTS,
  COMMERCIAL_STATUSES,
  COMMERCIAL_STATUS_LABELS,
  MAX_PER_PAGE,
  type Commercial,
  type CommercialListParams,
  type CommercialStatus,
} from "../model/commercial";

/**
 * The Commercials list (roadmap M3.3) — the third Network domain.
 *
 * WRITTEN BY COPYING MANAGERS, and deliberately not abstracted further. Per
 * the M3.3 planning decision, the URL-filter hook and every other shared
 * extraction stay deferred until Managers, Commercials and Clients are all
 * built and can be revisited together — consistent with M3.2's approach, not
 * a fresh call made here.
 *
 * ITS OWN CONTRACT, VERIFIED INDEPENDENTLY FROM SOURCE (`indexCommercials`),
 * NOT INHERITED FROM MANAGERS BY RESEMBLANCE — two prior verification passes
 * each found something the previous one missed:
 *   - pagination and search: YES, same shape as Managers, live-confirmed.
 *   - sorting: NO. `indexCommercials` accepts no sort parameter of any kind
 *     and hardcodes `date_ajout DESC` (BC-L), identically to Managers.
 *   - a detail page: NOT IN THIS MILESTONE (ADR-0014). No row links anywhere.
 *   - a secteur filter: DEFERRED BY DECISION. The filter exists server-side
 *     (`secteur`, exact match) but the transform never returns it, no
 *     secteurs are seeded in the dev database, and there is no options source
 *     to build a select from. A free-text box over an exact-match filter
 *     would be a control that appears to work and does not (ADR-0009).
 *   - manager reassignment: OUT OF SCOPE. It is the Agent Transfers feature
 *     (already has full backend infrastructure), not a field here.
 *
 * KNOWN BACKEND BEHAVIOUR THIS SCREEN DOES NOT PAPER OVER (identical to
 * Managers, confirmed to apply to `indexCommercials` independently):
 *   - SEARCH IS CASE-SENSITIVE (BC-O) — same `LIKE`, same four fields.
 *   - `date_to` EXCLUDES ITS OWN DAY (BC-P) — same uncast comparison.
 *   - INVALID FILTERS RETURN 500, NOT 422 (BC-N) — same swallowed
 *     `ValidationException`. Every control here is bounded, so the condition
 *     is unreachable through the UI.
 */

/** URL parameter names. The backend's spelling, so a shared link is self-describing. */
const PARAM = {
  page: "page",
  perPage: "per_page",
  search: "search",
  status: "status",
  villeActuelle: "ville_actuelle",
  managerId: "manager_id",
  dateFrom: "date_from",
  dateTo: "date_to",
} as const;

/**
 * Reads and RE-VALIDATES the query string (FTA §9, Design System §15) —
 * identical discipline to Managers, for the identical reason: BC-N means an
 * out-of-range value reaches a 500, not a 422, so a hostile URL must never
 * reach the API in the first place.
 */
function readParams(search: URLSearchParams): CommercialListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawPerPage = Number(search.get(PARAM.perPage));
  const rawStatus = search.get(PARAM.status);
  const rawManagerId = search.get(PARAM.managerId);

  return {
    page:
      Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : COMMERCIAL_LIST_DEFAULTS.page,
    perPage:
      Number.isInteger(rawPerPage) && rawPerPage >= 1 && rawPerPage <= MAX_PER_PAGE
        ? rawPerPage
        : COMMERCIAL_LIST_DEFAULTS.perPage,
    search: search.get(PARAM.search) ?? COMMERCIAL_LIST_DEFAULTS.search,
    status: COMMERCIAL_STATUSES.includes(rawStatus as CommercialStatus)
      ? (rawStatus as CommercialStatus)
      : COMMERCIAL_LIST_DEFAULTS.status,
    villeActuelle:
      search.get(PARAM.villeActuelle) ?? COMMERCIAL_LIST_DEFAULTS.villeActuelle,
    // A manager id must be a positive integer string, or it is unset — a
    // non-numeric value in the URL must never reach the API (BC-N).
    managerId:
      rawManagerId && Number.isInteger(Number(rawManagerId)) && Number(rawManagerId) >= 1
        ? rawManagerId
        : COMMERCIAL_LIST_DEFAULTS.managerId,
    dateFrom: search.get(PARAM.dateFrom) ?? COMMERCIAL_LIST_DEFAULTS.dateFrom,
    dateTo: search.get(PARAM.dateTo) ?? COMMERCIAL_LIST_DEFAULTS.dateTo,
  };
}

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function CommercialsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const commercialsQuery = useCommercialsQuery(params);
  const { has } = usePermission();

  /**
   * Each action mirrors ONE server-side check, identically to Managers. No
   * create gate (M3.6 wizard); no delete gate (soft block, BC-R).
   */
  const canUpdate = has(PERMISSIONS.UPDATE_AGENT);
  const canBlock = has(PERMISSIONS.BLOCK_AGENT);
  const canActivate = has(PERMISSIONS.ACTIVATE_AGENT);
  const hasAnyRowAction = canUpdate || canBlock || canActivate;

  /**
   * The city filter is gated on `access-dashboard`, mirroring Managers: that
   * is what guards `GET /admin/villes`, the endpoint backing its options.
   *
   * The manager filter carries NO such gate — `GET /admin/agents/managers`
   * shares this page's own `view-agents` permission, verified from
   * `routes/api.php`, so any operator who can reach this page can always
   * resolve it.
   */
  const canReadVilles = has(PERMISSIONS.ACCESS_DASHBOARD);

  const [editing, setEditing] = useState<Commercial | undefined>(undefined);
  const [blocking, setBlocking] = useState<Commercial | undefined>(undefined);
  const [activating, setActivating] = useState<Commercial | undefined>(undefined);

  const patchParams = (patch: Partial<CommercialListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    // Defaults are omitted, so an unfiltered view has a clean URL.
    if (next.page !== COMMERCIAL_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.perPage !== COMMERCIAL_LIST_DEFAULTS.perPage)
      query.set(PARAM.perPage, String(next.perPage));
    if (next.search) query.set(PARAM.search, next.search);
    if (next.status) query.set(PARAM.status, next.status);
    if (next.villeActuelle) query.set(PARAM.villeActuelle, next.villeActuelle);
    if (next.managerId) query.set(PARAM.managerId, next.managerId);
    if (next.dateFrom) query.set(PARAM.dateFrom, next.dateFrom);
    if (next.dateTo) query.set(PARAM.dateTo, next.dateTo);

    setSearchParams(query, { replace: true });
  };

  /**
   * Any filter change returns to page 1. The result set changed, so the old
   * page number refers to a list that no longer exists.
   */
  const filterBy = (patch: Partial<CommercialListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = commercialsQuery.data;

  const listErrorReference = isAppError(commercialsQuery.error)
    ? resolveErrorDisplay(commercialsQuery.error).requestId
    : undefined;

  const isFiltered =
    !!params.search ||
    !!params.status ||
    !!params.villeActuelle ||
    !!params.managerId ||
    !!params.dateFrom ||
    !!params.dateTo;

  return (
    <ListPage
      title="Commercials"
      // No create action: agent onboarding is the M3.6 wizard, not this screen.
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="commercialSearch" className="text-sm font-medium">
              Search
            </label>
            <Input
              id="commercialSearch"
              aria-label="Search commercials"
              // The backend uses LIKE on PostgreSQL — case-sensitive (BC-O).
              placeholder="Name, account or subscription (case-sensitive)"
              className="w-72"
              defaultValue={params.search}
              onChange={(event) => filterBy({ search: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="commercialStatus" className="text-sm font-medium">
              Status
            </label>
            <select
              id="commercialStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as CommercialStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {COMMERCIAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {COMMERCIAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {canReadVilles ? (
            <CommercialVilleFilter
              value={params.villeActuelle}
              onChange={(villeActuelle) => filterBy({ villeActuelle })}
            />
          ) : null}

          <CommercialManagerFilter
            value={params.managerId}
            onChange={(managerId) => filterBy({ managerId })}
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="commercialDateFrom" className="text-sm font-medium">
              Joined from
            </label>
            <Input
              id="commercialDateFrom"
              type="date"
              aria-label="Joined from"
              className="w-44"
              value={params.dateFrom}
              onChange={(event) => filterBy({ dateFrom: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="commercialDateTo" className="text-sm font-medium">
              Joined before
            </label>
            <Input
              id="commercialDateTo"
              type="date"
              // Labelled "before", not "to": the backend compares a datetime
              // column against midnight, so this date's own day is EXCLUDED (BC-P).
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
              Page {page.page} of {page.lastPage} · {page.total} commercials
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
      <p className="text-muted-foreground -mt-2 text-sm">
        Commercials operate in the field under a manager. Ordered by join date, most
        recent first.
      </p>

      {commercialsQuery.isPending ? (
        <ListLoadingState />
      ) : commercialsQuery.isError ? (
        <ListErrorState
          message="The list of commercials could not be loaded."
          reference={listErrorReference}
          onRetry={() => void commercialsQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No commercial matches these filters." : "No commercial yet."}
        </ListEmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {/* Plain headers throughout: the endpoint accepts no sort (BC-L). */}
                <th scope="col" className="p-2 font-medium">
                  Commercial
                </th>
                <th scope="col" className="p-2 font-medium">
                  Subscription
                </th>
                <th scope="col" className="p-2 font-medium">
                  Status
                </th>
                <th scope="col" className="p-2 font-medium">
                  Current city
                </th>
                <th scope="col" className="p-2 font-medium">
                  Manager
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
              {page?.items.map((commercial) => {
                const fullName = `${commercial.prenom} ${commercial.nom}`;
                return (
                  <tr key={commercial.id} className="border-b">
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Avatar>
                          {/* An absolute URL despite the wire key `photo_path`. */}
                          {commercial.photoUrl ? (
                            <AvatarImage src={commercial.photoUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {commercial.prenom.slice(0, 1)}
                            {commercial.nom.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span>{fullName}</span>
                          <span className="text-muted-foreground text-xs">
                            {commercial.numDeCompte}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground p-2">
                      {commercial.numAbonnement ?? ABSENT}
                    </td>
                    <td className="p-2">
                      {/* A three-value enum, labelled locally — same as Managers,
                          still short of ADR-0006's 3 for StatusBadge. */}
                      <span
                        className={
                          commercial.status === "active"
                            ? "text-sm"
                            : "text-muted-foreground text-sm"
                        }
                      >
                        {COMMERCIAL_STATUS_LABELS[commercial.status]}
                      </span>
                    </td>
                    <td className="p-2">{commercial.villeActuelle ?? ABSENT}</td>
                    <td className="p-2">
                      {/* A display string from the backend, not a relation —
                          there is no manager id here to link anywhere. */}
                      {commercial.manager ?? ABSENT}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {/* Rendered verbatim — the backend already formatted it to
                          2dp with bcadd. See model/commercial.ts. */}
                      {commercial.avanceTotal}
                    </td>
                    <td className="p-2">{formatDate(commercial.dateDebut)}</td>
                    <td className="p-2">
                      {hasAnyRowAction ? (
                        <div className="flex justify-end gap-2">
                          {canUpdate ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing(commercial)}
                              aria-label={`Edit ${fullName}`}
                            >
                              Edit
                            </Button>
                          ) : null}
                          {/* The backend 400s on a no-op, so each action is
                              offered only where it would actually change
                              something. An `inactive` account can receive either. */}
                          {canBlock && commercial.status !== "blocked" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBlocking(commercial)}
                              aria-label={`Block ${fullName}`}
                            >
                              Block
                            </Button>
                          ) : null}
                          {canActivate && commercial.status !== "active" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActivating(commercial)}
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

      <CommercialFormSheet
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        commercial={editing}
      />
      <CommercialStatusDialog
        commercial={blocking}
        action="block"
        onOpenChange={(open) => {
          if (!open) setBlocking(undefined);
        }}
      />
      <CommercialStatusDialog
        commercial={activating}
        action="activate"
        onOpenChange={(open) => {
          if (!open) setActivating(undefined);
        }}
      />
    </ListPage>
  );
}

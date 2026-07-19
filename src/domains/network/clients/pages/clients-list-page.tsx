import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { ABSENT, formatDate, formatPhone } from "@/shared/formatters";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ListPage } from "@/shared/components/patterns/list-page";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { ClientFormSheet } from "../components/client-form-sheet";
import { ClientStatusDialog } from "../components/client-status-dialog";
import { ClientVilleFilter } from "../components/client-ville-filter";
import { useClientsQuery } from "../queries/clients-queries";
import {
  CLIENT_LIST_DEFAULTS,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  MAX_PER_PAGE,
  type Client,
  type ClientListParams,
  type ClientStatus,
} from "../model/client";

/**
 * The Clients list (roadmap M3.4) — the fourth Network domain, and the
 * narrowest scope of the four by explicit decision, not by backend
 * limitation: `ClientController` exposes a full CRUD-plus-assignment
 * surface (create, delete, assign/reassign/unassign, bulk-assign,
 * statistics, password reset), of which this milestone deliberately builds
 * only list, edit and status.
 *
 * EXCLUDED BY DECISION, NOT DEFERRED FOR A CONTRACT REASON THE WAY
 * MANAGERS/COMMERCIALS' CREATE FORM WAS:
 *   - Create Client — `store()` needs no file uploads, so the M3.6-wizard
 *     reasoning that excluded Agent creation does not even apply here; it
 *     is out of scope by explicit instruction, not by necessity.
 *   - Delete Client — `Client::destroy()` is a REAL, permanent row deletion
 *     (no `SoftDeletes`), a materially different risk from the Agent
 *     domains' BC-R soft-block. Not offered.
 *   - Assign / Reassign / Bulk-assign / Reset password / Statistics — each
 *     a distinct, real backend capability, none built here. The roadmap
 *     itself names "Client bulk-assign" as its own separate M3.5
 *     deliverable, not part of this one.
 *   - A detail page — ADR-0014's pattern, unchanged.
 *   - Map/location editing — no map UI exists anywhere in this product yet.
 *
 * ITS OWN CONTRACT, VERIFIED INDEPENDENTLY FROM SOURCE
 * (`ClientController::index`), NOT INHERITED FROM THE AGENT DOMAINS BY
 * RESEMBLANCE:
 *   - NO TRANSFORM. `index()` returns the raw `Client` model serialization —
 *     the first resource in this product without a hand-picked row shape.
 *   - NO SORT, AND NO DATE FILTER OF ANY KIND — `index()`'s validator has
 *     neither, unlike `indexManagers`/`indexCommercials`, which at least
 *     lack sort but do accept dates. Nothing here invents either (ADR-0009).
 *   - A DIFFERENT STATUS VOCABULARY: `active|blocked|pending`, not
 *     `…|inactive`. `pending` clients arrive from the public OTP
 *     registration flow — entirely outside this screen — so a real operator
 *     can encounter one despite nothing here creating one.
 *   - ONE STATUS ACTION, NOT TWO. There is no separate block/activate pair
 *     for clients — `PATCH /{id}/status` is the only status-changing
 *     endpoint that exists. See `client-status-dialog.tsx` for how the
 *     single action is labelled correctly for all three starting states.
 *
 * KNOWN BACKEND BEHAVIOUR THIS SCREEN DOES NOT PAPER OVER:
 *   - SEARCH ON PHONE IS A PARTIAL MATCH, and — unlike the Agent domains'
 *     BC-O — genuinely has no case-sensitivity question: a phone number has
 *     no letters to have case.
 *   - A NONEXISTENT CLIENT ID 500s, NOT 404s, ON EVERY SINGLE-CLIENT ACTION
 *     (`show`, `update`, `toggleStatus`, and the excluded ones too) —
 *     confirmed live. `Client::findOrFail` sits inside a bare
 *     `catch (\Exception)` with no `ModelNotFoundException` carve-out,
 *     unlike `AgentController::show`, which does have one. Unreachable
 *     through this screen's own controls (it never constructs an id that
 *     does not exist), but a real, new backend defect, distinct from BC-N.
 *   - EDIT VALIDATION FAILURES 500, NOT 422, TOO — `update()`'s
 *     `$request->validate()` is inside the same kind of bare
 *     `catch (\Exception)`. The phone format is bounded client-side
 *     (mirroring the backend's own regex), but a DUPLICATE phone cannot be
 *     predicted client-side and would surface as a generic failure, not a
 *     friendly "this number is already in use" — see
 *     `client-form-sheet.tsx`.
 */

/** URL parameter names. The backend's spelling, so a shared link is self-describing. */
const PARAM = {
  page: "page",
  perPage: "per_page",
  search: "search",
  status: "status",
  assigned: "assigned",
  ville: "ville_comercial",
} as const;

/**
 * Reads and RE-VALIDATES the query string (FTA §9, Design System §15) —
 * identical discipline to every prior domain, for the identical reason:
 * a swallowed validation exception means an out-of-range value reaches a
 * 500, not a 422, so a hostile URL must never reach the API in the first
 * place.
 */
function readParams(search: URLSearchParams): ClientListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawPerPage = Number(search.get(PARAM.perPage));
  const rawStatus = search.get(PARAM.status);
  const rawAssigned = search.get(PARAM.assigned);

  return {
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : CLIENT_LIST_DEFAULTS.page,
    perPage:
      Number.isInteger(rawPerPage) && rawPerPage >= 1 && rawPerPage <= MAX_PER_PAGE
        ? rawPerPage
        : CLIENT_LIST_DEFAULTS.perPage,
    search: search.get(PARAM.search) ?? CLIENT_LIST_DEFAULTS.search,
    status: CLIENT_STATUSES.includes(rawStatus as ClientStatus)
      ? (rawStatus as ClientStatus)
      : CLIENT_LIST_DEFAULTS.status,
    assigned:
      rawAssigned === "true" || rawAssigned === "false"
        ? rawAssigned
        : CLIENT_LIST_DEFAULTS.assigned,
    ville: search.get(PARAM.ville) ?? CLIENT_LIST_DEFAULTS.ville,
  };
}

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

export function ClientsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const clientsQuery = useClientsQuery(params);
  const { has } = usePermission();

  /** Each action mirrors ONE server-side check. No create gate, no delete gate, no assign gate — all explicitly out of scope. */
  const canUpdate = has(PERMISSIONS.UPDATE_CLIENT);
  const canToggleStatus = has(PERMISSIONS.MANAGE_CLIENT_STATUS);
  const hasAnyRowAction = canUpdate || canToggleStatus;

  /** Gated on `access-dashboard`, exactly as the Agent domains' city filters — that is what guards `GET /admin/villes`. */
  const canReadVilles = has(PERMISSIONS.ACCESS_DASHBOARD);

  const [editing, setEditing] = useState<Client | undefined>(undefined);
  const [togglingStatus, setTogglingStatus] = useState<Client | undefined>(undefined);

  const patchParams = (patch: Partial<ClientListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    // Defaults are omitted, so an unfiltered view has a clean URL.
    if (next.page !== CLIENT_LIST_DEFAULTS.page) query.set(PARAM.page, String(next.page));
    if (next.perPage !== CLIENT_LIST_DEFAULTS.perPage)
      query.set(PARAM.perPage, String(next.perPage));
    if (next.search) query.set(PARAM.search, next.search);
    if (next.status) query.set(PARAM.status, next.status);
    if (next.assigned) query.set(PARAM.assigned, next.assigned);
    if (next.ville) query.set(PARAM.ville, next.ville);

    setSearchParams(query, { replace: true });
  };

  /**
   * Any filter change returns to page 1. The result set changed, so the old
   * page number refers to a list that no longer exists.
   */
  const filterBy = (patch: Partial<ClientListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = clientsQuery.data;

  const listErrorReference = isAppError(clientsQuery.error)
    ? resolveErrorDisplay(clientsQuery.error).requestId
    : undefined;

  const isFiltered =
    !!params.search || !!params.status || !!params.assigned || !!params.ville;

  return (
    <ListPage
      title="Clients"
      // No create action: excluded from this milestone's scope by decision,
      // not deferred for a wizard/file-upload reason.
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clientSearch" className="text-sm font-medium">
              Search
            </label>
            <Input
              id="clientSearch"
              aria-label="Search clients"
              // Partial match on phone. No case-sensitivity note here — a
              // phone number has no letters to have case.
              placeholder="Phone number"
              className="w-56"
              defaultValue={params.search}
              onChange={(event) => filterBy({ search: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="clientStatus" className="text-sm font-medium">
              Status
            </label>
            <select
              id="clientStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as ClientStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {CLIENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CLIENT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="clientAssigned" className="text-sm font-medium">
              Assignment
            </label>
            <select
              id="clientAssigned"
              aria-label="Filter by assignment"
              className={SELECT_CLASS}
              value={params.assigned}
              onChange={(event) =>
                filterBy({ assigned: event.target.value as "" | "true" | "false" })
              }
            >
              <option value="">All clients</option>
              <option value="true">Assigned</option>
              <option value="false">Unassigned</option>
            </select>
          </div>

          {canReadVilles ? (
            <ClientVilleFilter
              value={params.ville}
              onChange={(ville) => filterBy({ ville })}
            />
          ) : null}
        </div>
      }
      footer={
        page && page.lastPage > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {page.page} of {page.lastPage} · {page.total} clients
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
        Clients are the end customers commercials serve. Ordered by join date, most recent
        first.
      </p>

      {clientsQuery.isPending ? (
        <ListLoadingState />
      ) : clientsQuery.isError ? (
        <ListErrorState
          message="The list of clients could not be loaded."
          reference={listErrorReference}
          onRetry={() => void clientsQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No client matches these filters." : "No client yet."}
        </ListEmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {/* Plain headers throughout: the endpoint accepts no sort. */}
                <th scope="col" className="p-2 font-medium">
                  Phone
                </th>
                <th scope="col" className="p-2 font-medium">
                  Status
                </th>
                <th scope="col" className="p-2 font-medium">
                  City
                </th>
                <th scope="col" className="p-2 font-medium">
                  Agent
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Balance
                </th>
                <th scope="col" className="p-2 font-medium">
                  Joined
                </th>
                <th scope="col" className="w-48 p-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {page?.items.map((client) => (
                <tr key={client.id} className="border-b">
                  <td className="p-2">{formatPhone(client.phone)}</td>
                  <td className="p-2">
                    {/* A three-value enum, labelled locally — the THIRD real
                        status enum in the product (Managers, Commercials,
                        Clients), finally at ADR-0006's stated "3" for
                        StatusBadge. Not extracted here — see the module
                        docblock; the values differ (pending vs inactive), and
                        this is a decision for review, not one made silently. */}
                    <span
                      className={
                        client.status === "active"
                          ? "text-sm"
                          : "text-muted-foreground text-sm"
                      }
                    >
                      {CLIENT_STATUS_LABELS[client.status]}
                    </span>
                  </td>
                  <td className="p-2">{client.ville ?? ABSENT}</td>
                  <td className="p-2">
                    {/* A display string derived at the mapper boundary —
                        there is no id here to link anywhere, and assignment
                        is out of scope for this milestone. */}
                    {client.agentName ?? ABSENT}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {/* Rendered verbatim — a decimal-cast string, never
                        parsed. See model/client.ts. */}
                    {client.solde}
                  </td>
                  <td className="p-2">{formatDate(client.dateDebut)}</td>
                  <td className="p-2">
                    {hasAnyRowAction ? (
                      <div className="flex justify-end gap-2">
                        {canUpdate ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(client)}
                            aria-label={`Edit ${client.phone}`}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canToggleStatus ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTogglingStatus(client)}
                            aria-label={
                              client.status === "active"
                                ? `Block ${client.phone}`
                                : `Activate ${client.phone}`
                            }
                          >
                            {client.status === "active" ? "Block" : "Activate"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientFormSheet
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
        client={editing}
      />
      <ClientStatusDialog
        client={togglingStatus}
        onOpenChange={(open) => {
          if (!open) setTogglingStatus(undefined);
        }}
      />
    </ListPage>
  );
}

import { useNavigate, useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatIdentifier } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { DataTable, type DataTableColumn } from "@/shared/components/business/data-table";
import { FilterBar, FilterField } from "@/shared/components/business/filter-bar";
import { ListPage } from "@/shared/components/patterns/list-page";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { Button } from "@/shared/components/ui/button";
import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useCompanyOptionsQuery } from "@/domains/reference/companies";
import { useAllocationsQuery } from "../queries/allocations-queries";
import { allocationDetailPath, ALLOCATION_NEW_PATH } from "../routes";
import {
  ALLOCATION_LIST_DEFAULTS,
  ALLOCATION_STATUSES,
  ALLOCATION_STATUS_LABELS,
  ALLOCATION_STATUS_TONES,
  type Allocation,
  type AllocationListParams,
  type AllocationStatus,
} from "../model/allocation";

/**
 * The Allocations list (roadmap M5, Phase 4) — the fourth Stock list
 * screen, structurally mirroring Transfer's own list screen, but with a
 * genuinely new THIRD filter Return/Transfer never needed: Company.
 *
 * THREE FILTERS — status, agent (manager), company, mirroring
 * `IndexAllocationRequest`'s own validator exactly (verified fresh from
 * source). NO sort/direction CONTROL, NO per-page CONTROL — same "don't
 * build a control for an accepted-but-unexposed parameter" restraint
 * Return's/Transfer's own list already applies; the backend's own defaults
 * (`created_at desc`, `per_page=15`) apply.
 *
 * THE AGENT FILTER REUSES `useManagerOptionsQuery` UNFILTERED (every
 * manager, active or not) — a plain display filter, not the Create form's
 * binding-guaranteeing picker (which needs `status=active` only, see
 * `create-allocation-page.tsx`). Mirrors Transfer's own manager filter,
 * which makes the identical choice for the identical reason: filtering
 * historical allocations to a since-deactivated manager is still a
 * legitimate query.
 *
 * THE COMPANY FILTER REUSES `useCompanyOptionsQuery` (`domains/reference/
 * companies`) — a NEW reference-domain module built this phase specifically
 * because no equivalent existed before Allocation needed one. Every option
 * offered is already active (the backend's own `GET /admin/companies`
 * filters server-side), so there is no "select an inactive company and get
 * an empty result" trap.
 *
 * `montant` RENDERS VERBATIM, NOT THROUGH `<MoneyAmount>` — a
 * `decimal:2`-cast STRING, but UNLIKE Return's/Transfer's own metadata-only
 * `montant`, this one is LOAD-BEARING (see `model/allocation.ts`'s own
 * docblock) — still rendered as a plain string, since `<MoneyAmount>` takes
 * a `number` and parsing a `decimal:2` string back to one is exactly the
 * binary-floating-point defect this codebase avoids elsewhere (M4.1).
 *
 * A "View" ACTION COLUMN navigates to `AllocationDetailPage`.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PARAM = {
  page: "page",
  status: "status",
  agentId: "agent_id",
  companyId: "company_id",
} as const;

function readParams(search: URLSearchParams): AllocationListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawStatus = search.get(PARAM.status);

  return {
    ...ALLOCATION_LIST_DEFAULTS,
    page:
      Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : ALLOCATION_LIST_DEFAULTS.page,
    status: (ALLOCATION_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as AllocationStatus)
      : ALLOCATION_LIST_DEFAULTS.status,
    agentId: search.get(PARAM.agentId) ?? ALLOCATION_LIST_DEFAULTS.agentId,
    companyId: search.get(PARAM.companyId) ?? ALLOCATION_LIST_DEFAULTS.companyId,
  };
}

export function AllocationsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const allocationsQuery = useAllocationsQuery(params);

  const { has } = usePermission();
  const canReadAgents = has(PERMISSIONS.VIEW_AGENTS);
  const canCreateAllocation = has(PERMISSIONS.CREATE_ALLOCATION);

  const managersQuery = useManagerOptionsQuery();
  const companiesQuery = useCompanyOptionsQuery();

  const patchParams = (patch: Partial<AllocationListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    if (next.page !== ALLOCATION_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.status) query.set(PARAM.status, next.status);
    if (next.agentId) query.set(PARAM.agentId, next.agentId);
    if (next.companyId) query.set(PARAM.companyId, next.companyId);

    setSearchParams(query, { replace: true });
  };

  const filterBy = (patch: Partial<AllocationListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = allocationsQuery.data;

  const listErrorReference = isAppError(allocationsQuery.error)
    ? resolveErrorDisplay(allocationsQuery.error).requestId
    : undefined;

  const isFiltered = !!params.status || !!params.agentId || !!params.companyId;

  const columns: DataTableColumn<Allocation>[] = [
    {
      key: "allocationNumber",
      header: "Allocation number",
      cell: (a) => formatIdentifier(a.allocationNumber),
    },
    { key: "company", header: "Company", cell: (a) => a.companyName },
    { key: "agent", header: "Manager", cell: (a) => a.agentName },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <StatusBadge
          tone={ALLOCATION_STATUS_TONES[a.status]}
          label={ALLOCATION_STATUS_LABELS[a.status]}
        />
      ),
    },
    {
      key: "montant",
      header: "Amount",
      align: "right",
      cell: (a) => `${a.montant} DH`,
    },
    {
      key: "createdAt",
      header: "Date",
      cell: (a) => formatDate(a.createdAt),
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (a) => (
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate(allocationDetailPath(a.id))}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <ListPage
      title="Allocations"
      action={
        canCreateAllocation ? (
          <Button onClick={() => navigate(ALLOCATION_NEW_PATH)}>Record Allocation</Button>
        ) : null
      }
      filters={
        <FilterBar>
          <FilterField label="Status" htmlFor="allocationStatus">
            <select
              id="allocationStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as AllocationStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {ALLOCATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ALLOCATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Manager" htmlFor="allocationAgentFilter">
            <select
              id="allocationAgentFilter"
              aria-label="Filter by manager"
              className={SELECT_CLASS}
              value={params.agentId}
              onChange={(event) => filterBy({ agentId: event.target.value })}
              disabled={!canReadAgents}
            >
              <option value="">All managers</option>
              {(managersQuery.data ?? []).map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.prenom} {manager.nom}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Company" htmlFor="allocationCompanyFilter">
            <select
              id="allocationCompanyFilter"
              aria-label="Filter by company"
              className={SELECT_CLASS}
              value={params.companyId}
              onChange={(event) => filterBy({ companyId: event.target.value })}
            >
              <option value="">All companies</option>
              {(companiesQuery.data ?? []).map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </FilterField>
        </FilterBar>
      }
      footer={
        page && page.lastPage > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {page.page} of {page.lastPage} · {page.total} allocations
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
      {allocationsQuery.isPending ? (
        <ListLoadingState />
      ) : allocationsQuery.isError ? (
        <ListErrorState
          message="The list of allocations could not be loaded."
          reference={listErrorReference}
          onRetry={() => void allocationsQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No allocation matches these filters." : "No allocation yet."}
        </ListEmptyState>
      ) : (
        <DataTable columns={columns} rows={page?.items ?? []} rowKey={(a) => a.id} />
      )}
    </ListPage>
  );
}

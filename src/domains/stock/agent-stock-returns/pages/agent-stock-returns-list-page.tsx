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
import { useCommercialOptionsQuery } from "@/domains/network/commercials";
import { useManagerOptionsQuery } from "@/domains/network/managers";
import { useAgentStockReturnsQuery } from "../queries/agent-stock-returns-queries";
import { agentStockReturnDetailPath, AGENT_STOCK_RETURN_NEW_PATH } from "../routes";
import {
  AGENT_STOCK_RETURN_LIST_DEFAULTS,
  AGENT_STOCK_RETURN_STATUSES,
  AGENT_STOCK_RETURN_STATUS_LABELS,
  AGENT_STOCK_RETURN_STATUS_TONES,
  type AgentStockReturn,
  type AgentStockReturnListParams,
  type AgentStockReturnStatus,
} from "../model/agent-stock-return";

/**
 * The Agent Stock Returns list (roadmap M5, Phase 1) — the first Stock
 * resource, and the first Stock list screen.
 *
 * FOUR FILTERS — status, manager, commercial, mirroring
 * `IndexAgentStockReturnRequest`'s own validator exactly (verified fresh
 * from source). NO sort/direction CONTROL — both are accepted server-side,
 * but this screen does not expose one, the same "don't build a control for
 * an accepted-but-unexposed parameter" restraint Deposits' own list
 * already applies; the backend's own default (`created_at desc`) applies.
 * NO per-page CONTROL, same reasoning (`per_page` is `sometimes`, capped at
 * 100 — this screen never sends it, so the backend's own default (15)
 * applies).
 *
 * THE COMMERCIAL FILTER REUSES `useCommercialOptionsQuery` UNFILTERED BY
 * MANAGER — a plain display filter, not the Create form's binding-
 * guaranteeing cascade (`ReturnManagerCommercialField`). Filtering a list
 * by an arbitrary commercial carries none of Create's "must belong to this
 * manager" constraint.
 *
 * `montant` RENDERS VERBATIM, NOT THROUGH `<MoneyAmount>` — a
 * `decimal:2`-cast STRING (metadata-only, recomputed from lines), same
 * discipline as `Cheque.amount`.
 *
 * A "View" ACTION COLUMN navigates to `AgentStockReturnDetailPage` — the
 * same retrofit every prior list page's own detail page already got.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PARAM = {
  page: "page",
  status: "status",
  managerId: "manager_id",
  commercialId: "commercial_id",
} as const;

function readParams(search: URLSearchParams): AgentStockReturnListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawStatus = search.get(PARAM.status);

  return {
    ...AGENT_STOCK_RETURN_LIST_DEFAULTS,
    page:
      Number.isInteger(rawPage) && rawPage >= 1
        ? rawPage
        : AGENT_STOCK_RETURN_LIST_DEFAULTS.page,
    status: (AGENT_STOCK_RETURN_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as AgentStockReturnStatus)
      : AGENT_STOCK_RETURN_LIST_DEFAULTS.status,
    managerId: search.get(PARAM.managerId) ?? AGENT_STOCK_RETURN_LIST_DEFAULTS.managerId,
    commercialId:
      search.get(PARAM.commercialId) ?? AGENT_STOCK_RETURN_LIST_DEFAULTS.commercialId,
  };
}

export function AgentStockReturnsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const returnsQuery = useAgentStockReturnsQuery(params);

  const { has } = usePermission();
  const canReadAgents = has(PERMISSIONS.VIEW_AGENTS);
  const canCreateReturn = has(PERMISSIONS.CREATE_AGENT_STOCK_RETURN);

  const managersQuery = useManagerOptionsQuery();
  const commercialsQuery = useCommercialOptionsQuery({ enabled: canReadAgents });

  const patchParams = (patch: Partial<AgentStockReturnListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    if (next.page !== AGENT_STOCK_RETURN_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.status) query.set(PARAM.status, next.status);
    if (next.managerId) query.set(PARAM.managerId, next.managerId);
    if (next.commercialId) query.set(PARAM.commercialId, next.commercialId);

    setSearchParams(query, { replace: true });
  };

  const filterBy = (patch: Partial<AgentStockReturnListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = returnsQuery.data;

  const listErrorReference = isAppError(returnsQuery.error)
    ? resolveErrorDisplay(returnsQuery.error).requestId
    : undefined;

  const isFiltered = !!params.status || !!params.managerId || !!params.commercialId;

  const columns: DataTableColumn<AgentStockReturn>[] = [
    {
      key: "returnNumber",
      header: "Return number",
      cell: (r) => formatIdentifier(r.returnNumber),
    },
    { key: "commercial", header: "Commercial", cell: (r) => r.commercialName },
    { key: "manager", header: "Manager", cell: (r) => r.managerName },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge
          tone={AGENT_STOCK_RETURN_STATUS_TONES[r.status]}
          label={AGENT_STOCK_RETURN_STATUS_LABELS[r.status]}
        />
      ),
    },
    {
      key: "montant",
      header: "Amount",
      align: "right",
      cell: (r) => `${r.montant} DH`,
    },
    {
      key: "createdAt",
      header: "Date",
      cell: (r) => formatDate(r.createdAt),
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (r) => (
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate(agentStockReturnDetailPath(r.id))}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <ListPage
      title="Agent Stock Returns"
      action={
        canCreateReturn ? (
          <Button onClick={() => navigate(AGENT_STOCK_RETURN_NEW_PATH)}>
            Record Return
          </Button>
        ) : null
      }
      filters={
        <FilterBar>
          <FilterField label="Status" htmlFor="returnStatus">
            <select
              id="returnStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as AgentStockReturnStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {AGENT_STOCK_RETURN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {AGENT_STOCK_RETURN_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Manager" htmlFor="returnManagerFilter">
            <select
              id="returnManagerFilter"
              aria-label="Filter by manager"
              className={SELECT_CLASS}
              value={params.managerId}
              onChange={(event) => filterBy({ managerId: event.target.value })}
            >
              <option value="">All managers</option>
              {(managersQuery.data ?? []).map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.prenom} {manager.nom}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Commercial" htmlFor="returnCommercialFilter">
            <select
              id="returnCommercialFilter"
              aria-label="Filter by commercial"
              className={SELECT_CLASS}
              value={params.commercialId}
              onChange={(event) => filterBy({ commercialId: event.target.value })}
            >
              <option value="">All commercials</option>
              {(commercialsQuery.data ?? []).map((commercial) => (
                <option key={commercial.id} value={commercial.id}>
                  {commercial.prenom} {commercial.nom}
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
              Page {page.page} of {page.lastPage} · {page.total} returns
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
      {returnsQuery.isPending ? (
        <ListLoadingState />
      ) : returnsQuery.isError ? (
        <ListErrorState
          message="The list of stock returns could not be loaded."
          reference={listErrorReference}
          onRetry={() => void returnsQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No stock return matches these filters." : "No stock return yet."}
        </ListEmptyState>
      ) : (
        <DataTable columns={columns} rows={page?.items ?? []} rowKey={(r) => r.id} />
      )}
    </ListPage>
  );
}

import { useNavigate, useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatIdentifier } from "@/shared/formatters";
import { Input } from "@/shared/components/ui/input";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { MoneyAmount } from "@/shared/components/business/money-amount";
import { DataTable, type DataTableColumn } from "@/shared/components/business/data-table";
import { FilterBar, FilterField } from "@/shared/components/business/filter-bar";
import { ListPage } from "@/shared/components/patterns/list-page";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { Button } from "@/shared/components/ui/button";
import { DepositAgentFilter } from "../components/deposit-agent-filter";
import { useDepositsQuery } from "../queries/deposits-queries";
import { depositDetailPath } from "../routes";
import {
  DEPOSIT_LIST_DEFAULTS,
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_LABELS,
  DEPOSIT_STATUSES,
  DEPOSIT_STATUS_LABELS,
  DEPOSIT_STATUS_TONES,
  DEPOSIT_TYPES,
  DEPOSIT_TYPE_LABELS,
  type Deposit,
  type DepositListParams,
  type DepositMethod,
  type DepositStatus,
  type DepositType,
} from "../model/deposit";

/**
 * The Deposits list (M4.3 Phase 1) — the second Money resource, read-only.
 *
 * REUSES `ListPage`/`DataTable`/`FilterBar`/`StatusBadge`/`MoneyAmount`
 * UNCHANGED, the same shared layer Cheques' own list page already proved.
 * No new shared abstraction was built or considered for this phase.
 *
 * ONLY FIVE FILTERS — search, agent, method, type, status — because that
 * is the complete set `DepoController::index` actually supports (verified
 * fresh from source this phase). NO date range, NO sort, NO per-page
 * selector: `index()` runs no `$request->validate()` at all and calls
 * `$query->paginate(20)` with the page size HARDCODED — there is nothing
 * for a per-page control to send, and exposing one the API ignores would
 * misrepresent the system.
 *
 * `amount` RENDERS THROUGH `<MoneyAmount>` — genuinely appropriate here,
 * unlike Cheques': `DepoResource` casts `amount` to a real `(float)`, not a
 * `decimal:2` string. See `model/deposit.ts`'s own docblock.
 *
 * `type` RENDERS AS PLAIN TEXT, NOT `StatusBadge` — `type` is set once at
 * creation and never transitions; `StatusBadge` is reserved for lifecycle
 * status, which is what the separate `status` column already uses.
 *
 * `date` (the wire field) IS ALREADY ISO-NORMALIZED BY THE MAPPER
 * (`deposits-api.ts`'s `toIsoDateTime`) before it reaches this page — this
 * page calls the ordinary shared `formatDate`, same as every other list.
 *
 * A "View" ACTION COLUMN WAS ADDED AT PHASE 2, navigating to
 * `DepositDetailPage` (`depositDetailPath(deposit.id)`) — the same retrofit
 * Cheques' own list page got when its detail page landed. Gated on nothing
 * beyond this page's own `view-depos`, mirroring the detail route's own
 * permission exactly (the SAME check, `GET /admin/depos/{depo}`'s own guard).
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PARAM = {
  page: "page",
  search: "search",
  agentId: "agent_id",
  method: "method",
  type: "type",
  status: "status",
} as const;

function readParams(search: URLSearchParams): DepositListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawMethod = search.get(PARAM.method);
  const rawType = search.get(PARAM.type);
  const rawStatus = search.get(PARAM.status);

  return {
    page:
      Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : DEPOSIT_LIST_DEFAULTS.page,
    search: search.get(PARAM.search) ?? DEPOSIT_LIST_DEFAULTS.search,
    agentId: search.get(PARAM.agentId) ?? DEPOSIT_LIST_DEFAULTS.agentId,
    method: (DEPOSIT_METHODS as readonly string[]).includes(rawMethod ?? "")
      ? (rawMethod as DepositMethod)
      : DEPOSIT_LIST_DEFAULTS.method,
    type: (DEPOSIT_TYPES as readonly string[]).includes(rawType ?? "")
      ? (rawType as DepositType)
      : DEPOSIT_LIST_DEFAULTS.type,
    status: (DEPOSIT_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as DepositStatus)
      : DEPOSIT_LIST_DEFAULTS.status,
  };
}

export function DepositsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const depositsQuery = useDepositsQuery(params);

  const { has } = usePermission();
  const canReadAgents = has(PERMISSIONS.VIEW_AGENTS);

  const patchParams = (patch: Partial<DepositListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    // Defaults are omitted from the URL — "/money/deposits" beats
    // "/money/deposits?page=1&…" for a view the operator has not filtered.
    if (next.page !== DEPOSIT_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.search) query.set(PARAM.search, next.search);
    if (next.agentId) query.set(PARAM.agentId, next.agentId);
    if (next.method) query.set(PARAM.method, next.method);
    if (next.type) query.set(PARAM.type, next.type);
    if (next.status) query.set(PARAM.status, next.status);

    setSearchParams(query, { replace: true });
  };

  /** Any filter change returns to page 1 — the result set changed. */
  const filterBy = (patch: Partial<DepositListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = depositsQuery.data;

  const listErrorReference = isAppError(depositsQuery.error)
    ? resolveErrorDisplay(depositsQuery.error).requestId
    : undefined;

  const isFiltered =
    !!params.search ||
    !!params.agentId ||
    !!params.method ||
    !!params.type ||
    !!params.status;

  const columns: DataTableColumn<Deposit>[] = [
    {
      key: "receipt",
      header: "Receipt",
      cell: (deposit) => formatIdentifier(deposit.receipt),
    },
    {
      key: "agent",
      header: "Agent",
      cell: (deposit) => deposit.agentName,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (deposit) => <MoneyAmount value={deposit.amount} />,
    },
    {
      key: "type",
      header: "Type",
      cell: (deposit) => DEPOSIT_TYPE_LABELS[deposit.type],
    },
    {
      key: "status",
      header: "Status",
      cell: (deposit) => (
        <StatusBadge
          tone={DEPOSIT_STATUS_TONES[deposit.status]}
          label={DEPOSIT_STATUS_LABELS[deposit.status]}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      cell: (deposit) => formatDate(deposit.createdAt),
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (deposit) => (
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate(depositDetailPath(deposit.id))}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <ListPage
      title="Deposits"
      filters={
        <FilterBar>
          <FilterField label="Search" htmlFor="depositSearch">
            <Input
              id="depositSearch"
              aria-label="Search deposits"
              placeholder="Receipt or account number"
              className="w-56"
              defaultValue={params.search}
              onChange={(event) => filterBy({ search: event.target.value })}
            />
          </FilterField>

          <DepositAgentFilter
            value={params.agentId}
            onChange={(agentId) => filterBy({ agentId })}
            canReadAgents={canReadAgents}
          />

          <FilterField label="Method" htmlFor="depositMethod">
            <select
              id="depositMethod"
              aria-label="Filter by method"
              className={SELECT_CLASS}
              value={params.method}
              onChange={(event) =>
                filterBy({ method: event.target.value as DepositMethod | "" })
              }
            >
              <option value="">All methods</option>
              {DEPOSIT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {DEPOSIT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Type" htmlFor="depositType">
            <select
              id="depositType"
              aria-label="Filter by type"
              className={SELECT_CLASS}
              value={params.type}
              onChange={(event) =>
                filterBy({ type: event.target.value as DepositType | "" })
              }
            >
              <option value="">All types</option>
              {DEPOSIT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DEPOSIT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status" htmlFor="depositStatus">
            <select
              id="depositStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as DepositStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {DEPOSIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {DEPOSIT_STATUS_LABELS[status]}
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
              Page {page.page} of {page.lastPage} · {page.total} deposits
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
      {depositsQuery.isPending ? (
        <ListLoadingState />
      ) : depositsQuery.isError ? (
        <ListErrorState
          message="The list of deposits could not be loaded."
          reference={listErrorReference}
          onRetry={() => void depositsQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No deposit matches these filters." : "No deposit yet."}
        </ListEmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={page?.items ?? []}
          rowKey={(deposit) => deposit.id}
        />
      )}
    </ListPage>
  );
}

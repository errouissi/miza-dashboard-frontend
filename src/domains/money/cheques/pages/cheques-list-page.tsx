import { useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatDate, formatIdentifier } from "@/shared/formatters";
import { Input } from "@/shared/components/ui/input";
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
import { ChequeAgentFilter } from "../components/cheque-agent-filter";
import { useChequesQuery } from "../queries/cheques-queries";
import {
  CHEQUE_LIST_DEFAULTS,
  CHEQUE_STATUSES,
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_TONES,
  MAX_PER_PAGE,
  type Cheque,
  type ChequeListParams,
  type ChequeStatus,
} from "../model/cheque";

/**
 * The Cheques list (roadmap M4.2) — the first Money screen, and the first
 * resource outside Network.
 *
 * PHASE 2 — READ ONLY. List, filters, pagination. No submit form, no
 * pending queue, no approve/reject/annuler actions or dialogs, no detail
 * page — all later M4.2 phases. There is accordingly no actions column.
 *
 * `DataTable`/`FilterBar` ARE REAL SHARED COMPONENTS, extracted THIS
 * session from Villes/Managers/Commercials/Clients' identical inline
 * patterns — the Rule-of-Three evidence was already met as of M3.4; this
 * is the first caller to actually draw on it. Villes/Managers/Commercials/
 * Clients themselves are NOT retrofitted onto them here — that is a
 * separate, larger migration this phase does not attempt.
 *
 * `amount` IS RENDERED VERBATIM, NOT THROUGH `MoneyAmount` — despite
 * `MoneyAmount` existing. `cheques.amount` is a `decimal:2`-cast column,
 * which Eloquent serializes as a STRING, not a JSON number (verified
 * during Phase 1 — see `model/cheque.ts`). The exact same discipline
 * `Manager.avanceTotal`/`Client.solde` already established: carried and
 * rendered verbatim, tabular-nums, never parsed. `MoneyAmount` remains
 * correctly unused for any of Money's own amount fields until a case is
 * found where parsing is genuinely safe and deliberate.
 *
 * THE AGENT FILTER MERGES TWO EXISTING PICKERS (`ChequeAgentFilter`) rather
 * than inventing a cross-role search endpoint — see that component's own
 * docblock for the full reasoning and its one disclosed gap (inactive
 * commercials are not findable through it).
 *
 * A BC-P-CLASS DATE-RANGE QUIRK, NEW AND MORE NARROW THAN MANAGERS'/
 * COMMERCIALS' OWN: `ChequeController::index` uses `whereDate()` (correctly
 * day-inclusive) when ONLY ONE of `date_from`/`date_to` is given, but
 * `whereBetween()` against the raw `created_at` TIMESTAMP column (excluding
 * most of the `date_to` day) when BOTH are given together. "Submitted
 * before" is still the honest label — it is exactly true whenever both
 * filters are set together, and harmlessly conservative when `date_to` is
 * used alone.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PARAM = {
  page: "page",
  perPage: "per_page",
  search: "search",
  status: "status",
  agentId: "agent_id",
  dateFrom: "date_from",
  dateTo: "date_to",
} as const;

function readParams(search: URLSearchParams): ChequeListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawPerPage = Number(search.get(PARAM.perPage));
  const rawStatus = search.get(PARAM.status);

  return {
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : CHEQUE_LIST_DEFAULTS.page,
    perPage:
      Number.isInteger(rawPerPage) && rawPerPage >= 1 && rawPerPage <= MAX_PER_PAGE
        ? rawPerPage
        : CHEQUE_LIST_DEFAULTS.perPage,
    search: search.get(PARAM.search) ?? CHEQUE_LIST_DEFAULTS.search,
    status: (CHEQUE_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as ChequeStatus)
      : CHEQUE_LIST_DEFAULTS.status,
    agentId: search.get(PARAM.agentId) ?? CHEQUE_LIST_DEFAULTS.agentId,
    dateFrom: search.get(PARAM.dateFrom) ?? CHEQUE_LIST_DEFAULTS.dateFrom,
    dateTo: search.get(PARAM.dateTo) ?? CHEQUE_LIST_DEFAULTS.dateTo,
  };
}

export function ChequesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const chequesQuery = useChequesQuery(params);

  const { has } = usePermission();
  const canReadAgents = has(PERMISSIONS.VIEW_AGENTS);

  const patchParams = (patch: Partial<ChequeListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    // Defaults are omitted from the URL — "/money/cheques" beats
    // "/money/cheques?page=1&…" for a view the operator has not filtered.
    if (next.page !== CHEQUE_LIST_DEFAULTS.page) query.set(PARAM.page, String(next.page));
    if (next.perPage !== CHEQUE_LIST_DEFAULTS.perPage)
      query.set(PARAM.perPage, String(next.perPage));
    if (next.search) query.set(PARAM.search, next.search);
    if (next.status) query.set(PARAM.status, next.status);
    if (next.agentId) query.set(PARAM.agentId, next.agentId);
    if (next.dateFrom) query.set(PARAM.dateFrom, next.dateFrom);
    if (next.dateTo) query.set(PARAM.dateTo, next.dateTo);

    setSearchParams(query, { replace: true });
  };

  /** Any filter change returns to page 1 — the result set changed. */
  const filterBy = (patch: Partial<ChequeListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = chequesQuery.data;

  const listErrorReference = isAppError(chequesQuery.error)
    ? resolveErrorDisplay(chequesQuery.error).requestId
    : undefined;

  const isFiltered =
    !!params.search ||
    !!params.status ||
    !!params.agentId ||
    !!params.dateFrom ||
    !!params.dateTo;

  const columns: DataTableColumn<Cheque>[] = [
    {
      key: "numCheque",
      header: "Cheque #",
      cell: (cheque) => formatIdentifier(cheque.numCheque),
    },
    {
      key: "agent",
      header: "Agent",
      cell: (cheque) => cheque.agentName,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      // Rendered verbatim — see the module docblock. Not `<MoneyAmount>`.
      cell: (cheque) => cheque.amount,
    },
    {
      key: "status",
      header: "Status",
      cell: (cheque) => (
        <StatusBadge
          tone={CHEQUE_STATUS_TONES[cheque.status]}
          label={CHEQUE_STATUS_LABELS[cheque.status]}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Submitted",
      cell: (cheque) => formatDate(cheque.createdAt),
    },
  ];

  return (
    <ListPage
      title="Cheques"
      filters={
        <FilterBar>
          <FilterField label="Search" htmlFor="chequeSearch">
            <Input
              id="chequeSearch"
              aria-label="Search cheques"
              placeholder="Cheque number"
              className="w-56"
              defaultValue={params.search}
              onChange={(event) => filterBy({ search: event.target.value })}
            />
          </FilterField>

          <FilterField label="Status" htmlFor="chequeStatus">
            <select
              id="chequeStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as ChequeStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {CHEQUE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CHEQUE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FilterField>

          <ChequeAgentFilter
            value={params.agentId}
            onChange={(agentId) => filterBy({ agentId })}
            canReadAgents={canReadAgents}
          />

          <FilterField label="Submitted from" htmlFor="chequeDateFrom">
            <Input
              id="chequeDateFrom"
              type="date"
              aria-label="Submitted from"
              className="w-44"
              value={params.dateFrom}
              onChange={(event) => filterBy({ dateFrom: event.target.value })}
            />
          </FilterField>

          <FilterField label="Submitted before" htmlFor="chequeDateTo">
            <Input
              id="chequeDateTo"
              type="date"
              aria-label="Submitted before"
              className="w-44"
              value={params.dateTo}
              onChange={(event) => filterBy({ dateTo: event.target.value })}
            />
          </FilterField>
        </FilterBar>
      }
      footer={
        page && page.lastPage > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {page.page} of {page.lastPage} · {page.total} cheques
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
      {chequesQuery.isPending ? (
        <ListLoadingState />
      ) : chequesQuery.isError ? (
        <ListErrorState
          message="The list of cheques could not be loaded."
          reference={listErrorReference}
          onRetry={() => void chequesQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No cheque matches these filters." : "No cheque yet."}
        </ListEmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={page?.items ?? []}
          rowKey={(cheque) => cheque.id}
        />
      )}
    </ListPage>
  );
}

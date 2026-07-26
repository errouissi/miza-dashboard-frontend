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
import { useAgentTransfersQuery } from "../queries/agent-transfers-queries";
import { agentTransferDetailPath, AGENT_TRANSFER_NEW_PATH } from "../routes";
import {
  AGENT_TRANSFER_LIST_DEFAULTS,
  AGENT_TRANSFER_STATUSES,
  AGENT_TRANSFER_STATUS_LABELS,
  AGENT_TRANSFER_STATUS_TONES,
  type AgentTransfer,
  type AgentTransferListParams,
  type AgentTransferStatus,
} from "../model/agent-transfer";

/**
 * The Agent Transfers list (roadmap M5, Phase 2) — the second Stock list
 * screen, mirroring Return's own list screen structurally.
 *
 * FOUR FILTERS — status, manager, commercial, mirroring
 * `IndexAgentTransferRequest`'s own validator exactly (verified fresh from
 * source). NO sort/direction CONTROL, NO per-page CONTROL — same "don't
 * build a control for an accepted-but-unexposed parameter" restraint
 * Return's own list already applies; the backend's own defaults
 * (`created_at desc`, `per_page=15`) apply.
 *
 * THE COMMERCIAL FILTER REUSES `useCommercialOptionsQuery` UNFILTERED BY
 * MANAGER — a plain display filter, not the Create form's binding-
 * guaranteeing cascade (`TransferManagerCommercialField`).
 *
 * `montant` RENDERS VERBATIM, NOT THROUGH `<MoneyAmount>` — a
 * `decimal:2`-cast STRING (metadata-only, recomputed from lines), same
 * discipline as Return's own list.
 *
 * A "View" ACTION COLUMN navigates to `AgentTransferDetailPage`.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PARAM = {
  page: "page",
  status: "status",
  managerId: "manager_id",
  commercialId: "commercial_id",
} as const;

function readParams(search: URLSearchParams): AgentTransferListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawStatus = search.get(PARAM.status);

  return {
    ...AGENT_TRANSFER_LIST_DEFAULTS,
    page:
      Number.isInteger(rawPage) && rawPage >= 1
        ? rawPage
        : AGENT_TRANSFER_LIST_DEFAULTS.page,
    status: (AGENT_TRANSFER_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as AgentTransferStatus)
      : AGENT_TRANSFER_LIST_DEFAULTS.status,
    managerId: search.get(PARAM.managerId) ?? AGENT_TRANSFER_LIST_DEFAULTS.managerId,
    commercialId:
      search.get(PARAM.commercialId) ?? AGENT_TRANSFER_LIST_DEFAULTS.commercialId,
  };
}

export function AgentTransfersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const transfersQuery = useAgentTransfersQuery(params);

  const { has } = usePermission();
  const canReadAgents = has(PERMISSIONS.VIEW_AGENTS);
  const canCreateTransfer = has(PERMISSIONS.CREATE_AGENT_TRANSFER);

  const managersQuery = useManagerOptionsQuery();
  const commercialsQuery = useCommercialOptionsQuery({ enabled: canReadAgents });

  const patchParams = (patch: Partial<AgentTransferListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    if (next.page !== AGENT_TRANSFER_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.status) query.set(PARAM.status, next.status);
    if (next.managerId) query.set(PARAM.managerId, next.managerId);
    if (next.commercialId) query.set(PARAM.commercialId, next.commercialId);

    setSearchParams(query, { replace: true });
  };

  const filterBy = (patch: Partial<AgentTransferListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = transfersQuery.data;

  const listErrorReference = isAppError(transfersQuery.error)
    ? resolveErrorDisplay(transfersQuery.error).requestId
    : undefined;

  const isFiltered = !!params.status || !!params.managerId || !!params.commercialId;

  const columns: DataTableColumn<AgentTransfer>[] = [
    {
      key: "transferNumber",
      header: "Transfer number",
      cell: (t) => formatIdentifier(t.transferNumber),
    },
    { key: "manager", header: "Manager", cell: (t) => t.managerName },
    { key: "commercial", header: "Commercial", cell: (t) => t.commercialName },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <StatusBadge
          tone={AGENT_TRANSFER_STATUS_TONES[t.status]}
          label={AGENT_TRANSFER_STATUS_LABELS[t.status]}
        />
      ),
    },
    {
      key: "montant",
      header: "Amount",
      align: "right",
      cell: (t) => `${t.montant} DH`,
    },
    {
      key: "createdAt",
      header: "Date",
      cell: (t) => formatDate(t.createdAt),
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (t) => (
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate(agentTransferDetailPath(t.id))}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <ListPage
      title="Agent Transfers"
      action={
        canCreateTransfer ? (
          <Button onClick={() => navigate(AGENT_TRANSFER_NEW_PATH)}>
            Record Transfer
          </Button>
        ) : null
      }
      filters={
        <FilterBar>
          <FilterField label="Status" htmlFor="transferStatus">
            <select
              id="transferStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as AgentTransferStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {AGENT_TRANSFER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {AGENT_TRANSFER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Manager" htmlFor="transferManagerFilter">
            <select
              id="transferManagerFilter"
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

          <FilterField label="Commercial" htmlFor="transferCommercialFilter">
            <select
              id="transferCommercialFilter"
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
              Page {page.page} of {page.lastPage} · {page.total} transfers
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
      {transfersQuery.isPending ? (
        <ListLoadingState />
      ) : transfersQuery.isError ? (
        <ListErrorState
          message="The list of transfers could not be loaded."
          reference={listErrorReference}
          onRetry={() => void transfersQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No transfer matches these filters." : "No transfer yet."}
        </ListEmptyState>
      ) : (
        <DataTable columns={columns} rows={page?.items ?? []} rowKey={(t) => t.id} />
      )}
    </ListPage>
  );
}

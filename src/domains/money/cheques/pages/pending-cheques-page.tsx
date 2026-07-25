import { useNavigate, useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatIdentifier, formatDate } from "@/shared/formatters";
import { StatusBadge } from "@/shared/components/business/status-badge";
import { DataTable, type DataTableColumn } from "@/shared/components/business/data-table";
import { ListPage } from "@/shared/components/patterns/list-page";
import {
  ListEmptyState,
  ListErrorState,
  ListLoadingState,
} from "@/shared/components/patterns/list-states";
import { Button } from "@/shared/components/ui/button";
import { usePendingChequesQuery } from "../queries/cheques-queries";
import { chequeDetailPath } from "../routes";
import {
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_TONES,
  MAX_PER_PAGE,
  PENDING_CHEQUE_LIST_DEFAULTS,
  type Cheque,
  type PendingChequeListParams,
} from "../model/cheque";

/**
 * The Pending Cheques queue (M4.2 Phase 3B) — the Super-Admin approval
 * queue, gated on its own permission (`view-pending-cheques`), distinct
 * from the general list's `view-cheques`.
 *
 * REUSES `ListPage`/`DataTable`/`StatusBadge`, deliberately NOT a new
 * `ApprovalQueuePage` shared pattern, even though the frozen architecture
 * doc names one for this exact screen. `GET /admin/cheques/pending` has
 * exactly one consumer today (Rule-of-Three not yet met — CLAUDE.md), and
 * this phase ships no approve/reject actions, so there is nothing
 * "actionable" for a queue-specific shell to add over a plain filtered
 * list. Extract `ApprovalQueuePage` when Deposits' own pending queue lands
 * and the inline approve/reject actions exist to justify the shape.
 *
 * NO `FilterBar` — verified from source (`ChequeController::pending`) that
 * the endpoint runs no `$request->validate()` and applies no filter at
 * all beyond the fixed `pending()` scope; only `page`/`per_page` are ever
 * meaningful. Exposing search/status/agent/date controls over an endpoint
 * that ignores them would misrepresent the system (session-bootstrap.md's
 * own working principle).
 *
 * NO `status` COLUMN VALUE OTHER THAN "Pending" WILL EVER RENDER HERE — the
 * backend scope guarantees it — but the column stays for the same reason
 * the general list has one: consistent row shape, and it costs nothing.
 *
 * `amount` IS RENDERED VERBATIM, NOT THROUGH `MoneyAmount` — same
 * `decimal:2`-cast-string discipline as the general list (see
 * `cheques-list-page.tsx`'s own docblock and `model/cheque.ts`).
 */

const PARAM = {
  page: "page",
  perPage: "per_page",
} as const;

function readParams(search: URLSearchParams): PendingChequeListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawPerPage = Number(search.get(PARAM.perPage));

  return {
    page:
      Number.isInteger(rawPage) && rawPage >= 1
        ? rawPage
        : PENDING_CHEQUE_LIST_DEFAULTS.page,
    perPage:
      Number.isInteger(rawPerPage) && rawPerPage >= 1 && rawPerPage <= MAX_PER_PAGE
        ? rawPerPage
        : PENDING_CHEQUE_LIST_DEFAULTS.perPage,
  };
}

export function PendingChequesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const pendingQuery = usePendingChequesQuery(params);

  const patchParams = (patch: Partial<PendingChequeListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    if (next.page !== PENDING_CHEQUE_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.perPage !== PENDING_CHEQUE_LIST_DEFAULTS.perPage)
      query.set(PARAM.perPage, String(next.perPage));

    setSearchParams(query, { replace: true });
  };

  const page = pendingQuery.data;

  const listErrorReference = isAppError(pendingQuery.error)
    ? resolveErrorDisplay(pendingQuery.error).requestId
    : undefined;

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
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (cheque) => (
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate(chequeDetailPath(cheque.id))}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <ListPage
      title="Pending Cheques"
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
      {pendingQuery.isPending ? (
        <ListLoadingState />
      ) : pendingQuery.isError ? (
        <ListErrorState
          message="The pending cheques queue could not be loaded."
          reference={listErrorReference}
          onRetry={() => void pendingQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>No cheque is pending approval.</ListEmptyState>
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

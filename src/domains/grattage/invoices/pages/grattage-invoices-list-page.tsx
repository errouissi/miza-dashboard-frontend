import { useNavigate, useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatDate } from "@/shared/formatters";
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
import { Input } from "@/shared/components/ui/input";
import { useGrattageInvoicesQuery } from "../queries/grattage-invoices-queries";
import { grattageInvoiceDetailPath } from "../routes";
import {
  GRATTAGE_INVOICE_LIST_DEFAULTS,
  GRATTAGE_INVOICE_STATUSES,
  GRATTAGE_INVOICE_STATUS_LABELS,
  GRATTAGE_INVOICE_STATUS_TONES,
  type GrattageInvoice,
  type GrattageInvoiceListParams,
  type GrattageInvoiceStatus,
} from "../model/grattage-invoice";

/**
 * The Grattage Invoices list (roadmap M6, Phase 1) — read + cancel only,
 * the first Grattage screen.
 *
 * REUSES `ListPage`/`DataTable`/`FilterBar`/`StatusBadge` UNCHANGED, the
 * same shared layer every prior domain's own list page already proved. No
 * new shared abstraction was built or considered for this phase.
 *
 * ONLY THREE FILTERS — status, date from, date to — a DELIBERATELY
 * NARROWER SET than `index()` actually supports (`agent_id`/`client_id`
 * are also accepted server-side); see `model/grattage-invoice.ts`'s own
 * docblock for why. NO search box: `index()` has no `search` parameter at
 * all (verified from source).
 *
 * `totalAmount` RENDERS VERBATIM, NOT THROUGH `<MoneyAmount>` — it is a
 * `decimal:2`-cast STRING with no Resource layer, the same discipline
 * Cheques'/Bons' own amount/montant fields already established (see
 * `model/grattage-invoice.ts`'s own docblock).
 *
 * A "View" ACTION COLUMN navigates to `GrattageInvoiceDetailPage`
 * (`grattageInvoiceDetailPath(invoice.id)`) — gated on nothing beyond this
 * page's own `access-dashboard`, mirroring the detail route's identical
 * permission.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PARAM = {
  page: "page",
  status: "status",
  dateFrom: "date_from",
  dateTo: "date_to",
} as const;

function readParams(search: URLSearchParams): GrattageInvoiceListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawStatus = search.get(PARAM.status);

  return {
    page:
      Number.isInteger(rawPage) && rawPage >= 1
        ? rawPage
        : GRATTAGE_INVOICE_LIST_DEFAULTS.page,
    status: (GRATTAGE_INVOICE_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as GrattageInvoiceStatus)
      : GRATTAGE_INVOICE_LIST_DEFAULTS.status,
    dateFrom: search.get(PARAM.dateFrom) ?? GRATTAGE_INVOICE_LIST_DEFAULTS.dateFrom,
    dateTo: search.get(PARAM.dateTo) ?? GRATTAGE_INVOICE_LIST_DEFAULTS.dateTo,
  };
}

export function GrattageInvoicesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const invoicesQuery = useGrattageInvoicesQuery(params);

  const patchParams = (patch: Partial<GrattageInvoiceListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    // Defaults are omitted from the URL, same convention every other list
    // page already applies.
    if (next.page !== GRATTAGE_INVOICE_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.status) query.set(PARAM.status, next.status);
    if (next.dateFrom) query.set(PARAM.dateFrom, next.dateFrom);
    if (next.dateTo) query.set(PARAM.dateTo, next.dateTo);

    setSearchParams(query, { replace: true });
  };

  /** Any filter change returns to page 1 — the result set changed. */
  const filterBy = (patch: Partial<GrattageInvoiceListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = invoicesQuery.data;

  const listErrorReference = isAppError(invoicesQuery.error)
    ? resolveErrorDisplay(invoicesQuery.error).requestId
    : undefined;

  const isFiltered = !!params.status || !!params.dateFrom || !!params.dateTo;

  const columns: DataTableColumn<GrattageInvoice>[] = [
    {
      key: "id",
      header: "Invoice",
      cell: (invoice) => `#${invoice.id}`,
    },
    {
      key: "agent",
      header: "Commercial",
      cell: (invoice) => invoice.agentName,
    },
    {
      key: "client",
      header: "Client",
      cell: (invoice) => invoice.clientPhone,
    },
    {
      key: "totalAmount",
      header: "Amount",
      align: "right",
      // Rendered verbatim — see the module docblock. Not `<MoneyAmount>`.
      cell: (invoice) => <span className="tabular-nums">{invoice.totalAmount} DH</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (invoice) => (
        <StatusBadge
          tone={GRATTAGE_INVOICE_STATUS_TONES[invoice.status]}
          label={GRATTAGE_INVOICE_STATUS_LABELS[invoice.status]}
        />
      ),
    },
    {
      key: "soldAt",
      header: "Sold",
      cell: (invoice) => formatDate(invoice.soldAt),
    },
    {
      key: "dueAt",
      header: "Due",
      cell: (invoice) => formatDate(invoice.dueAt),
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (invoice) => (
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate(grattageInvoiceDetailPath(invoice.id))}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <ListPage
      title="Grattage Invoices"
      filters={
        <FilterBar>
          <FilterField label="Status" htmlFor="grattageInvoiceStatus">
            <select
              id="grattageInvoiceStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as GrattageInvoiceStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {GRATTAGE_INVOICE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {GRATTAGE_INVOICE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="From" htmlFor="grattageInvoiceDateFrom">
            <Input
              id="grattageInvoiceDateFrom"
              aria-label="From date"
              type="date"
              className="w-40"
              value={params.dateFrom}
              onChange={(event) => filterBy({ dateFrom: event.target.value })}
            />
          </FilterField>

          <FilterField label="To" htmlFor="grattageInvoiceDateTo">
            <Input
              id="grattageInvoiceDateTo"
              aria-label="To date"
              type="date"
              className="w-40"
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
              Page {page.page} of {page.lastPage} · {page.total} invoices
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
      {invoicesQuery.isPending ? (
        <ListLoadingState />
      ) : invoicesQuery.isError ? (
        <ListErrorState
          message="The list of grattage invoices could not be loaded."
          reference={listErrorReference}
          onRetry={() => void invoicesQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered
            ? "No grattage invoice matches these filters."
            : "No grattage invoice yet."}
        </ListEmptyState>
      ) : (
        <DataTable
          columns={columns}
          rows={page?.items ?? []}
          rowKey={(invoice) => invoice.id}
        />
      )}
    </ListPage>
  );
}

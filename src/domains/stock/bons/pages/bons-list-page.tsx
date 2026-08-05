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
import { useSupplierOptionsQuery } from "@/domains/reference/suppliers";
import { useCompanyOptionsQuery } from "@/domains/reference/companies";
import { useBonsQuery } from "../queries/bons-queries";
import { bonDetailPath, BON_NEW_PATH } from "../routes";
import {
  BON_LIST_DEFAULTS,
  BON_STATUSES,
  BON_STATUS_LABELS,
  BON_STATUS_TONES,
  type Bon,
  type BonListParams,
  type BonStatus,
} from "../model/bon";

/**
 * The Bons list (roadmap M5, Phase 5) — the fifth and final Stock list
 * screen. THREE FILTERS — status, supplier, company, mirroring
 * `IndexBonRequest`'s own validator exactly (verified fresh from source).
 * NO sort/direction CONTROL, NO per-page CONTROL — same restraint every
 * prior Stock list already applies.
 *
 * BOTH THE SUPPLIER AND COMPANY FILTERS REUSE `useSupplierOptionsQuery`/
 * `useCompanyOptionsQuery` UNCHANGED — a plain display filter, every
 * option offered already active server-side (no inactive-selection trap).
 *
 * `montant` RENDERS VERBATIM — metadata-only here (unlike Allocation's own
 * load-bearing `montant`), a `decimal:2`-cast STRING, same discipline as
 * Return's/Transfer's own list.
 *
 * SHOWS `receivedAt`, NOT `createdAt` — the domain-meaningful date for
 * this resource (and the backend's own default sort column), rendered as
 * "—" when absent (it is `nullable`).
 *
 * A "View" ACTION COLUMN navigates to `BonDetailPage`.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

const PARAM = {
  page: "page",
  status: "status",
  supplierId: "supplier_id",
  companyId: "company_id",
} as const;

function readParams(search: URLSearchParams): BonListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawStatus = search.get(PARAM.status);

  return {
    ...BON_LIST_DEFAULTS,
    page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : BON_LIST_DEFAULTS.page,
    status: (BON_STATUSES as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as BonStatus)
      : BON_LIST_DEFAULTS.status,
    supplierId: search.get(PARAM.supplierId) ?? BON_LIST_DEFAULTS.supplierId,
    companyId: search.get(PARAM.companyId) ?? BON_LIST_DEFAULTS.companyId,
  };
}

export function BonsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const bonsQuery = useBonsQuery(params);

  const { has } = usePermission();
  const canCreateBon = has(PERMISSIONS.CREATE_BON);

  const suppliersQuery = useSupplierOptionsQuery();
  const companiesQuery = useCompanyOptionsQuery();

  const patchParams = (patch: Partial<BonListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    if (next.page !== BON_LIST_DEFAULTS.page) query.set(PARAM.page, String(next.page));
    if (next.status) query.set(PARAM.status, next.status);
    if (next.supplierId) query.set(PARAM.supplierId, next.supplierId);
    if (next.companyId) query.set(PARAM.companyId, next.companyId);

    setSearchParams(query, { replace: true });
  };

  const filterBy = (patch: Partial<BonListParams>) => patchParams({ ...patch, page: 1 });

  const page = bonsQuery.data;

  const listErrorReference = isAppError(bonsQuery.error)
    ? resolveErrorDisplay(bonsQuery.error).requestId
    : undefined;

  const isFiltered = !!params.status || !!params.supplierId || !!params.companyId;

  const columns: DataTableColumn<Bon>[] = [
    {
      key: "bonNumber",
      header: "Bon number",
      cell: (b) => formatIdentifier(b.bonNumber),
    },
    { key: "supplier", header: "Supplier", cell: (b) => b.supplierName },
    { key: "company", header: "Company", cell: (b) => b.companyName },
    {
      key: "status",
      header: "Status",
      cell: (b) => (
        <StatusBadge
          tone={BON_STATUS_TONES[b.status]}
          label={BON_STATUS_LABELS[b.status]}
        />
      ),
    },
    {
      key: "montant",
      header: "Amount",
      align: "right",
      cell: (b) => `${b.montant} DH`,
    },
    {
      key: "receivedAt",
      header: "Received",
      cell: (b) => (b.receivedAt ? formatDate(b.receivedAt) : "—"),
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (b) => (
        <Button variant="link" size="sm" onClick={() => navigate(bonDetailPath(b.id))}>
          View
        </Button>
      ),
    },
  ];

  return (
    <ListPage
      title="Bons"
      action={
        canCreateBon ? (
          <Button onClick={() => navigate(BON_NEW_PATH)}>Record Bon</Button>
        ) : null
      }
      filters={
        <FilterBar>
          <FilterField label="Status" htmlFor="bonStatus">
            <select
              id="bonStatus"
              aria-label="Filter by status"
              className={SELECT_CLASS}
              value={params.status}
              onChange={(event) =>
                filterBy({ status: event.target.value as BonStatus | "" })
              }
            >
              <option value="">All statuses</option>
              {BON_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {BON_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Supplier" htmlFor="bonSupplierFilter">
            <select
              id="bonSupplierFilter"
              aria-label="Filter by supplier"
              className={SELECT_CLASS}
              value={params.supplierId}
              onChange={(event) => filterBy({ supplierId: event.target.value })}
            >
              <option value="">All suppliers</option>
              {(suppliersQuery.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Company" htmlFor="bonCompanyFilter">
            <select
              id="bonCompanyFilter"
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
              Page {page.page} of {page.lastPage} · {page.total} bons
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
      {bonsQuery.isPending ? (
        <ListLoadingState />
      ) : bonsQuery.isError ? (
        <ListErrorState
          message="The list of bons could not be loaded."
          reference={listErrorReference}
          onRetry={() => void bonsQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No bon matches these filters." : "No bon yet."}
        </ListEmptyState>
      ) : (
        <DataTable columns={columns} rows={page?.items ?? []} rowKey={(b) => b.id} />
      )}
    </ListPage>
  );
}

import { useNavigate, useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { ABSENT, formatDateTime } from "@/shared/formatters";
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
import {
  OPERATORS,
  isOperator,
  useProductOptionsQuery,
} from "@/domains/reference/products";
import { useStockMovementsQuery } from "../queries/stock-movements-queries";
import {
  STOCK_MOVEMENT_LIST_DEFAULTS,
  type StockMovement,
  type StockMovementListParams,
} from "../model/stock-movement";

/**
 * The Stock Movements list (Phase 2C) — the read-only, backend-paginated
 * audit ledger over `GET /admin/stock/movements`, using Phase 2A's own
 * data layer unchanged (no `model`/`api`/`queries` file was touched by this
 * phase). REUSES `ListPage`/`FilterBar`/`DataTable`/`ListLoadingState`/
 * `ListErrorState`/`ListEmptyState` exactly as every sibling Stock list
 * page already does — no new shared abstraction.
 *
 * AUDIT-ONLY: no mutation, no create/edit/delete, no chart, no frontend
 * business calculation. The entire row is never clickable — only the
 * Reference cell navigates, mirroring every other list page's own
 * dedicated "View" action rather than a row-level click handler.
 *
 * FIVE BACKEND-DRIVEN FILTERS (`type`, `operator`, `product_id`, `from`,
 * `to`) plus `page`, kept in the URL exactly like Bons'/Grattage Invoices'
 * own list pages — Stock Overview's "View movements" action drills in via
 * a literal `?product_id=` query string (ADR-0030 precedent, no
 * route-module import), so the URL is this page's only channel for that
 * hand-off and a browser refresh must not lose it.
 *
 * MOVEMENT TYPE OPTIONS ARE THE 7 REACHABLE VALUES ONLY, not all 11 the
 * backend's `VALID_MOVEMENT_TYPES` validator accepts — verified fresh from
 * source (`StockController`'s own comment: the other 4 are legacy generic
 * values "even though no current writer produces them", confirmed 0 real
 * rows in `AdminStockMovementsHttpTest.php`'s own docblock). Offering a
 * filter option that can only ever return zero rows would be a control
 * that appears to work and does not (ADR-0009's own discipline, applied to
 * a reachability gap rather than a missing capability). Each option's
 * label is copied VERBATIM from the backend's own `movement_type_label`
 * output for that type (verified from `AdminStockMovementsHttpTest.php`'s
 * own per-write-path representation tests) — this is not a second,
 * independent label mapping; the TABLE'S OWN Movement column still renders
 * `movementTypeLabel` from each row, never from this list.
 *
 * REFERENCE NAVIGATION USES LITERAL PATH STRINGS, never a route-module
 * import from Bons/Allocations/Agent Transfers/Agent Stock Returns/
 * Grattage Invoices — the same ADR-0030 precedent Stock Overview's own
 * "View movements" link already established, avoiding five new
 * domain-to-domain import edges for one presentational link. The five
 * reference types are EXHAUSTIVE, verified fresh from source
 * (`StockService::presentReference()`'s own `match` over the five
 * mutually-exclusive FK columns) — an unrecognized future type still
 * renders as plain text rather than a broken link or a crash.
 *
 * STATUS RENDERS AS PLAIN TEXT, not `StatusBadge` — no existing domain's
 * own `*_STATUS_TONES` map covers `stock_movements.status`'s exact enum
 * (`pending`/`validated`/`cancelled`, verified from `StockMovement.php`'s
 * own docblock), and inventing one here would be exactly the new
 * badge/tone system this phase's own scope excludes.
 *
 * DATE RANGE VALIDATION IS NOT DUPLICATED CLIENT-SIDE — `from`/`to` are
 * two independent `<Input type="date">` controls with no cross-field
 * `min`/`max`, the same convention Grattage Invoices'/Cheques'/Managers'/
 * Commercials' own date-range filters already use. An invalid range
 * (`from > to`) reaches the backend's real 422 and surfaces through the
 * existing `ListErrorState`, never a frontend-invented refusal.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

/**
 * Labels copied verbatim from the backend's own `movement_type_label`
 * output for each reachable type — see the module docblock above.
 */
const MOVEMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "supplier_ingress", label: "Supplier → Company (Intake)" },
  { value: "supplier_ingress_reversal", label: "Company → Supplier (Bon Cancelled)" },
  { value: "agent_allocation", label: "Company → Manager (Allocation)" },
  { value: "agent_transfer", label: "Manager → Commercial (Transfer)" },
  { value: "agent_return", label: "Commercial → Manager (Return)" },
  { value: "client_sale", label: "Commercial → Client (Sale)" },
  { value: "client_sale_reversal", label: "Sale Cancelled (Restored to Commercial)" },
];
const MOVEMENT_TYPE_VALUES = MOVEMENT_TYPE_OPTIONS.map((option) => option.value);

/**
 * Exhaustive per `StockService::presentReference()` — see the module
 * docblock. Each builder mirrors the sibling resource's own
 * `*DetailPath()` helper as a literal string, not an import.
 */
const REFERENCE_PATH_BUILDERS: Record<string, (id: number) => string> = {
  bon: (id) => `/stock/bons/${id}`,
  allocation: (id) => `/stock/allocations/${id}`,
  transfer: (id) => `/stock/agent-transfers/${id}`,
  return: (id) => `/stock/agent-stock-returns/${id}`,
  invoice: (id) => `/grattage/invoices/${id}`,
};

const REFERENCE_TYPE_LABELS: Record<string, string> = {
  bon: "Bon",
  allocation: "Allocation",
  transfer: "Transfer",
  return: "Return",
  invoice: "Invoice",
};

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

const PARAM = {
  page: "page",
  type: "type",
  operator: "operator",
  productId: "product_id",
  from: "from",
  to: "to",
} as const;

function readParams(search: URLSearchParams): StockMovementListParams {
  const rawPage = Number(search.get(PARAM.page));
  const rawType = search.get(PARAM.type) ?? "";
  const rawOperator = search.get(PARAM.operator);

  return {
    page:
      Number.isInteger(rawPage) && rawPage >= 1
        ? rawPage
        : STOCK_MOVEMENT_LIST_DEFAULTS.page,
    type: MOVEMENT_TYPE_VALUES.includes(rawType)
      ? rawType
      : STOCK_MOVEMENT_LIST_DEFAULTS.type,
    operator: isOperator(rawOperator)
      ? rawOperator
      : STOCK_MOVEMENT_LIST_DEFAULTS.operator,
    productId: search.get(PARAM.productId) ?? STOCK_MOVEMENT_LIST_DEFAULTS.productId,
    from: search.get(PARAM.from) ?? STOCK_MOVEMENT_LIST_DEFAULTS.from,
    to: search.get(PARAM.to) ?? STOCK_MOVEMENT_LIST_DEFAULTS.to,
  };
}

function holderLabel(
  holder: { type: string; id: number; label: string | null } | null,
): string {
  if (!holder) return ABSENT;
  // `label` is independently nullable — a dangling reference (id present,
  // the row it points to no longer resolves) is a real, disclosed backend
  // case (`StockService::presentHolder()`'s own docblock), never fabricated.
  return holder.label ?? ABSENT;
}

export function StockMovementsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);
  const movementsQuery = useStockMovementsQuery(params);
  const productsQuery = useProductOptionsQuery();

  const patchParams = (patch: Partial<StockMovementListParams>) => {
    const next = { ...params, ...patch };
    const query = new URLSearchParams();

    if (next.page !== STOCK_MOVEMENT_LIST_DEFAULTS.page)
      query.set(PARAM.page, String(next.page));
    if (next.type) query.set(PARAM.type, next.type);
    if (next.operator) query.set(PARAM.operator, next.operator);
    if (next.productId) query.set(PARAM.productId, next.productId);
    if (next.from) query.set(PARAM.from, next.from);
    if (next.to) query.set(PARAM.to, next.to);

    setSearchParams(query, { replace: true });
  };

  /** Any filter change returns to page 1 — the result set changed. */
  const filterBy = (patch: Partial<StockMovementListParams>) =>
    patchParams({ ...patch, page: 1 });

  const page = movementsQuery.data;

  const listErrorReference = isAppError(movementsQuery.error)
    ? resolveErrorDisplay(movementsQuery.error).requestId
    : undefined;

  const isFiltered =
    !!params.type ||
    !!params.operator ||
    !!params.productId ||
    !!params.from ||
    !!params.to;

  const columns: DataTableColumn<StockMovement>[] = [
    {
      key: "createdAt",
      header: "Date / Time",
      cell: (m) => formatDateTime(m.createdAt),
    },
    {
      key: "movement",
      header: "Movement",
      // The backend's own truthful label, rendered verbatim — no frontend
      // movement-type label map (see the module docblock).
      cell: (m) => m.movementTypeLabel,
    },
    {
      key: "product",
      header: "Product",
      cell: (m) => (m.product ? `${m.product.operator} · ${m.product.name}` : ABSENT),
    },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      cell: (m) => m.quantity,
    },
    {
      key: "source",
      header: "Source",
      cell: (m) => holderLabel(m.source),
    },
    {
      key: "destination",
      header: "Destination",
      cell: (m) => holderLabel(m.destination),
    },
    {
      key: "status",
      header: "Status",
      cell: (m) => capitalize(m.status),
    },
    {
      key: "reference",
      header: "Reference",
      cell: (m) => {
        if (!m.reference) return ABSENT;

        const label = `${REFERENCE_TYPE_LABELS[m.reference.type] ?? m.reference.type} #${m.reference.id}`;
        const path = REFERENCE_PATH_BUILDERS[m.reference.type]?.(m.reference.id);

        return path ? (
          <Button variant="link" size="sm" onClick={() => navigate(path)}>
            {label}
          </Button>
        ) : (
          label
        );
      },
    },
  ];

  return (
    <ListPage
      title="Stock Movements"
      filters={
        <FilterBar>
          <FilterField label="Movement type" htmlFor="stockMovementType">
            <select
              id="stockMovementType"
              aria-label="Filter by movement type"
              className={SELECT_CLASS}
              value={params.type}
              onChange={(event) => filterBy({ type: event.target.value })}
            >
              <option value="">All movement types</option>
              {MOVEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Operator" htmlFor="stockMovementOperator">
            <select
              id="stockMovementOperator"
              aria-label="Filter by operator"
              className={SELECT_CLASS}
              value={params.operator}
              onChange={(event) =>
                filterBy({
                  operator: event.target.value as StockMovementListParams["operator"],
                })
              }
            >
              <option value="">All operators</option>
              {OPERATORS.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Product" htmlFor="stockMovementProduct">
            <select
              id="stockMovementProduct"
              aria-label="Filter by product"
              className={SELECT_CLASS}
              value={params.productId}
              onChange={(event) => filterBy({ productId: event.target.value })}
            >
              <option value="">All products</option>
              {(productsQuery.data ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="From" htmlFor="stockMovementFrom">
            <Input
              id="stockMovementFrom"
              aria-label="From date"
              type="date"
              className="w-40"
              value={params.from}
              onChange={(event) => filterBy({ from: event.target.value })}
            />
          </FilterField>

          <FilterField label="To" htmlFor="stockMovementTo">
            <Input
              id="stockMovementTo"
              aria-label="To date"
              type="date"
              className="w-40"
              value={params.to}
              onChange={(event) => filterBy({ to: event.target.value })}
            />
          </FilterField>
        </FilterBar>
      }
      footer={
        page && page.lastPage > 1 ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Page {page.page} of {page.lastPage} · {page.total} movements
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
      {movementsQuery.isPending ? (
        <ListLoadingState />
      ) : movementsQuery.isError ? (
        <ListErrorState
          message="The stock movement ledger could not be loaded."
          reference={listErrorReference}
          onRetry={() => void movementsQuery.refetch()}
        />
      ) : page && page.items.length === 0 ? (
        <ListEmptyState>
          {isFiltered ? "No movement matches these filters." : "No movement yet."}
        </ListEmptyState>
      ) : (
        <DataTable columns={columns} rows={page?.items ?? []} rowKey={(m) => m.id} />
      )}
    </ListPage>
  );
}

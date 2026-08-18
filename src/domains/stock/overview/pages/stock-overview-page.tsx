import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { formatMoney } from "@/shared/formatters";
import { StatCard } from "@/shared/components/business/stat-card";
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
import { OPERATORS, type Operator } from "@/domains/reference/products";
import { useStockOverviewQuery } from "../queries/stock-overview-queries";
import type { StockOverviewProduct } from "../model/stock-overview";

/**
 * The Stock Overview screen (Phase 2B) — the first Stock domain page that
 * is a network-wide READ, not a movement-workflow list. Composed from the
 * SAME shared primitives every existing list page already uses
 * (`ListPage`, `FilterBar`/`FilterField`, `DataTable`,
 * `ListLoadingState`/`ListErrorState`/`ListEmptyState`, `StatCard`,
 * `MoneyAmount`) — no new shared abstraction, no parallel UI system.
 *
 * ONE QUERY DRIVES THE WHOLE PAGE (`useStockOverviewQuery`) — summary cards
 * and the inventory table are both read from the same response, so there
 * is one loading state and one error state for all of it, mirroring
 * `CommercialStockTotal`'s own "one query, one loading/error state for all
 * of it" precedent (`domains/network/agents`).
 *
 * FILTERS ARE PURELY CLIENT-SIDE — `GET /admin/stock` accepts no query
 * parameters at all (verified from source, `StockController::index()`
 * takes no `Request`). The operator/stock-state controls below filter the
 * already-fetched `products[]` array in memory; they are never sent to the
 * backend, and nothing here pretends otherwise (ADR-0009 discipline).
 *
 * SUMMARY CARDS NEVER READ FROM THE FILTERED ARRAY — `summary.*` is always
 * rendered from `overviewQuery.data.summary` directly, the network-wide
 * backend aggregate, regardless of the operator/stock-state filters
 * selected. Filtering the table must never make the summary cards lie
 * about the network total (CLAUDE.md: no frontend business calculations
 * that should remain backend-authoritative).
 *
 * "Out of stock" FOR THIS SCREEN MEANS `totalQuantity === 0` — the
 * network-wide fact, not `companyQuantity === 0` (a different, narrower
 * backend-authoritative concept already exposed separately via the
 * Company Out of Stock summary card). No low-stock threshold exists
 * anywhere in this codebase or the backend — none is invented here.
 *
 * `operator`/`product_id`(→`productId`) TOTAL VALUE RENDERS THROUGH
 * `<MoneyAmount>` — `totalValue` is a plain integer (face value ×
 * quantity), the same convention `Product.value` already established, NOT
 * a `decimal`-cast string.
 *
 * "VIEW MOVEMENTS" NAVIGATES VIA A LITERAL PATH STRING
 * (`/stock/movements?product_id=...`), per the approved Phase 2 plan
 * (ADR-0030 precedent — a literal cross-page link, not a route-module
 * import) — Phase 2C's own Movements route does not exist as a built
 * page yet, only as this approved future path.
 */

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]";

type StockStateFilter = "all" | "out-of-stock";

export function StockOverviewPage() {
  const navigate = useNavigate();
  const overviewQuery = useStockOverviewQuery();

  const [operatorFilter, setOperatorFilter] = useState<Operator | "">("");
  const [stockState, setStockState] = useState<StockStateFilter>("all");

  const listErrorReference = isAppError(overviewQuery.error)
    ? resolveErrorDisplay(overviewQuery.error).requestId
    : undefined;

  const allProducts = overviewQuery.data?.products ?? [];
  const filteredProducts = allProducts.filter((product) => {
    if (operatorFilter && product.operator !== operatorFilter) return false;
    if (stockState === "out-of-stock" && product.totalQuantity !== 0) return false;
    return true;
  });
  const isFiltered = operatorFilter !== "" || stockState !== "all";

  const columns: DataTableColumn<StockOverviewProduct>[] = [
    { key: "operator", header: "Operator", cell: (p) => p.operator },
    { key: "name", header: "Product", cell: (p) => p.name },
    {
      key: "companyQuantity",
      header: "Company Qty",
      align: "right",
      cell: (p) => p.companyQuantity,
    },
    {
      key: "managerQuantity",
      header: "Manager Qty",
      align: "right",
      cell: (p) => p.managerQuantity,
    },
    {
      key: "commercialQuantity",
      header: "Commercial Qty",
      align: "right",
      cell: (p) => p.commercialQuantity,
    },
    {
      key: "totalQuantity",
      header: "Total Qty",
      align: "right",
      // Modest emphasis — this is the row's own total, not just another
      // holder column.
      cell: (p) => <span className="font-semibold">{p.totalQuantity}</span>,
    },
    {
      key: "totalValue",
      header: "Total Value",
      align: "right",
      cell: (p) => <MoneyAmount value={p.totalValue} />,
    },
    {
      key: "actions",
      header: "Actions",
      srOnlyHeader: true,
      cell: (p) => (
        <Button
          variant="link"
          size="sm"
          onClick={() => navigate(`/stock/movements?product_id=${p.productId}`)}
        >
          View movements
        </Button>
      ),
    },
  ];

  return (
    <ListPage title="Stock Overview">
      {overviewQuery.isPending ? (
        <ListLoadingState />
      ) : overviewQuery.isError ? (
        <ListErrorState
          message="Stock overview could not be loaded."
          reference={listErrorReference}
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Units" value={overviewQuery.data.summary.totalUnits} />
            <StatCard
              label="Total Stock Value"
              value={formatMoney(overviewQuery.data.summary.totalStockValue)}
            />
            <StatCard
              label="Company Out of Stock"
              value={overviewQuery.data.summary.companyOutOfStockProducts}
            />
            <StatCard
              label="Network Out of Stock"
              value={overviewQuery.data.summary.networkOutOfStockProducts}
            />
          </div>

          <FilterBar>
            <FilterField label="Operator" htmlFor="stockOverviewOperator">
              <select
                id="stockOverviewOperator"
                aria-label="Filter by operator"
                className={SELECT_CLASS}
                value={operatorFilter}
                onChange={(event) =>
                  setOperatorFilter(event.target.value as Operator | "")
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

            <FilterField label="Stock state" htmlFor="stockOverviewState">
              <select
                id="stockOverviewState"
                aria-label="Filter by stock state"
                className={SELECT_CLASS}
                value={stockState}
                onChange={(event) =>
                  setStockState(event.target.value as StockStateFilter)
                }
              >
                <option value="all">All stock</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </FilterField>
          </FilterBar>

          {allProducts.length === 0 ? (
            <ListEmptyState>No product yet.</ListEmptyState>
          ) : filteredProducts.length === 0 ? (
            <ListEmptyState>
              {isFiltered ? "No product matches these filters." : "No product yet."}
            </ListEmptyState>
          ) : (
            <DataTable
              columns={columns}
              rows={filteredProducts}
              rowKey={(p) => p.productId}
            />
          )}
        </div>
      )}
    </ListPage>
  );
}

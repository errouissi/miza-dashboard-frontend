import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAppError, resolveErrorDisplay } from "@/infrastructure/errors";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { usePermission } from "@/shared/hooks";
import { formatMoney } from "@/shared/formatters";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ProductFormSheet } from "../components/product-form-sheet";
import { DeleteProductDialog } from "../components/delete-product-dialog";
import { useProductsQuery } from "../queries/products-queries";
import {
  OPERATORS,
  isOperator,
  type Product,
  type ProductListParams,
} from "../model/product";

/**
 * The Products list (roadmap M2b — the third case).
 *
 * WRITTEN BY COPYING VILLES AND SECTEURS, and deliberately not abstracted. This
 * is the screen that makes the shared pattern's shape evidence rather than a
 * guess, which is precisely why extracting it HERE would defeat the exercise:
 * M2c extracts, from three working screens, once they exist (FTA §12).
 *
 * IT EXPOSES ONLY WHAT THE ENDPOINT SUPPORTS. `ProductController::index` returns
 * `$query->get()` with a single optional `operator` filter: no pagination, no
 * search, no sorting. So there is no search box, no sortable header and no pager.
 * Rendering those over an API that ignores them — or faking them client-side over
 * a full-table fetch — would misrepresent the system and hide the gap.
 *
 * `value` is DISPLAYED as money (Design System §5) but EDITED as a plain integer:
 * the column is dirhams, the backend column is `integer`. See the form sheet.
 *
 * This domain imports nothing from Villes or Secteurs — it has no relation to
 * resolve and no picker to feed.
 */
const OPERATOR_PARAM = "operator";

function readParams(search: URLSearchParams): ProductListParams {
  const raw = search.get(OPERATOR_PARAM);
  // Re-validated against the backend's enum: the query string is user-controlled,
  // and a value outside IAM|INWI|ORANGE must never reach the API.
  return isOperator(raw) ? { operator: raw } : {};
}

export function ProductsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = readParams(searchParams);

  const productsQuery = useProductsQuery(params);

  const { has } = usePermission();
  const canManage = has(PERMISSIONS.ACCESS_DASHBOARD);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>(undefined);
  const [deleting, setDeleting] = useState<Product | undefined>(undefined);

  const setOperatorFilter = (operator: string) => {
    const query = new URLSearchParams();
    if (isOperator(operator)) query.set(OPERATOR_PARAM, operator);
    setSearchParams(query, { replace: true });
  };

  const listErrorReference = isAppError(productsQuery.error)
    ? resolveErrorDisplay(productsQuery.error).requestId
    : undefined;

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setFormOpen(true);
  };

  const products = productsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Products</h1>
        {canManage ? <Button onClick={openCreate}>New product</Button> : null}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="operatorFilter" className="text-sm font-medium">
          Operator
        </label>
        <select
          id="operatorFilter"
          aria-label="Filter by operator"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 max-w-xs rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          value={params.operator ?? ""}
          onChange={(event) => setOperatorFilter(event.target.value)}
        >
          <option value="">All operators</option>
          {OPERATORS.map((operator) => (
            <option key={operator} value={operator}>
              {operator}
            </option>
          ))}
        </select>
      </div>

      {productsQuery.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : productsQuery.isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-12">
          <p className="text-sm">The list of products could not be loaded.</p>
          {listErrorReference ? (
            <p className="text-muted-foreground font-mono text-xs">
              Ref. {listErrorReference}
            </p>
          ) : null}
          <Button variant="outline" onClick={() => void productsQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : products && products.length === 0 ? (
        <p className="text-muted-foreground py-12 text-sm">
          {params.operator !== undefined
            ? "No product for this operator."
            : "No product yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                {/* Plain headers: the endpoint accepts no `sort`, so a clickable
                    header would promise an ordering it cannot deliver. */}
                <th scope="col" className="p-2 font-medium">
                  Name
                </th>
                <th scope="col" className="p-2 font-medium">
                  Operator
                </th>
                <th scope="col" className="p-2 text-right font-medium">
                  Value
                </th>
                <th scope="col" className="w-40 p-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products?.map((product) => (
                <tr key={product.id} className="border-b">
                  <td className="p-2">{product.name}</td>
                  <td className="text-muted-foreground p-2">{product.operator}</td>
                  {/* Money renders through the shared formatter, never inline
                      (FTA §14, Design System §5). Right-aligned so denominations
                      compare down the column. */}
                  <td className="p-2 text-right tabular-nums">
                    {formatMoney(product.value)}
                  </td>
                  <td className="p-2">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(product)}
                          aria-label={`Edit ${product.name}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleting(product)}
                          aria-label={`Delete ${product.name}`}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormSheet open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <DeleteProductDialog
        product={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined);
        }}
      />
    </div>
  );
}

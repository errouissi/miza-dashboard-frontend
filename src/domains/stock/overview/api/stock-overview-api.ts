import { httpClient } from "@/infrastructure/http";
import type { Operator } from "@/domains/reference/products";
import type {
  StockOverview,
  StockOverviewProduct,
  StockOverviewSummary,
} from "../model/stock-overview";

type StockOverviewProductRow = {
  product_id: number;
  operator: Operator;
  name: string;
  value: number;
  company_quantity: number;
  manager_quantity: number;
  commercial_quantity: number;
  total_quantity: number;
  company_value: number;
  manager_value: number;
  commercial_value: number;
  total_value: number;
};

type StockOverviewSummaryRow = {
  total_units: number;
  total_stock_value: number;
  company_out_of_stock_products: number;
  network_out_of_stock_products: number;
};

/**
 * `GET /admin/stock` — verified fresh from source
 * (`StockController::index()` → `StockService::aggregateInventory()`).
 *
 * NO ENVELOPE WRAPPER — the response body IS the object
 * (`response()->json($stock->aggregateInventory())` directly), the same
 * no-wrapper discipline `dashboard-statistics-api.ts` already established
 * for a different endpoint. NO PAGINATION — `aggregateInventory()` returns
 * every product in one array; there is no page to normalize.
 */
type StockOverviewEnvelope = {
  products: StockOverviewProductRow[];
  summary: StockOverviewSummaryRow;
};

function toStockOverviewProduct(row: StockOverviewProductRow): StockOverviewProduct {
  return {
    productId: row.product_id,
    operator: row.operator,
    name: row.name,
    value: row.value,
    companyQuantity: row.company_quantity,
    managerQuantity: row.manager_quantity,
    commercialQuantity: row.commercial_quantity,
    totalQuantity: row.total_quantity,
    companyValue: row.company_value,
    managerValue: row.manager_value,
    commercialValue: row.commercial_value,
    totalValue: row.total_value,
  };
}

function toStockOverviewSummary(row: StockOverviewSummaryRow): StockOverviewSummary {
  return {
    totalUnits: row.total_units,
    totalStockValue: row.total_stock_value,
    companyOutOfStockProducts: row.company_out_of_stock_products,
    networkOutOfStockProducts: row.network_out_of_stock_products,
  };
}

export async function fetchStockOverview(): Promise<StockOverview> {
  const { data } = await httpClient.get<StockOverviewEnvelope>("/admin/stock");

  return {
    products: data.products.map(toStockOverviewProduct),
    summary: toStockOverviewSummary(data.summary),
  };
}

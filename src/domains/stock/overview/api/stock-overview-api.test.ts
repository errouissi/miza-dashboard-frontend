import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { fetchStockOverview } from "./stock-overview-api";

const API = "http://localhost/api/v1";

/**
 * A plain, no-React unit test of the mapper — mirrors
 * `dashboard-statistics-api.test.ts`'s own convention (a direct `fetch*`
 * call against the shared MSW `server`, no DOM in between).
 */
function overviewEnvelope(
  overrides: Partial<{
    products: unknown[];
    summary: {
      total_units: number;
      total_stock_value: number;
      company_out_of_stock_products: number;
      network_out_of_stock_products: number;
    };
  }> = {},
) {
  return {
    products: overrides.products ?? [
      {
        product_id: 1,
        operator: "IAM",
        name: "IAM 10dh",
        value: 10,
        company_quantity: 15,
        manager_quantity: 3,
        commercial_quantity: 0,
        total_quantity: 18,
        company_value: 150,
        manager_value: 30,
        commercial_value: 0,
        total_value: 180,
      },
    ],
    summary: overrides.summary ?? {
      total_units: 18,
      total_stock_value: 180,
      company_out_of_stock_products: 0,
      network_out_of_stock_products: 0,
    },
  };
}

function overviewHandler(envelope: ReturnType<typeof overviewEnvelope>) {
  return http.get(`${API}/admin/stock`, () => HttpResponse.json(envelope));
}

describe("fetchStockOverview", () => {
  it("maps the snake_case product row to the camelCase domain model", async () => {
    server.use(overviewHandler(overviewEnvelope()));

    const result = await fetchStockOverview();

    expect(result.products).toEqual([
      {
        productId: 1,
        operator: "IAM",
        name: "IAM 10dh",
        value: 10,
        companyQuantity: 15,
        managerQuantity: 3,
        commercialQuantity: 0,
        totalQuantity: 18,
        companyValue: 150,
        managerValue: 30,
        commercialValue: 0,
        totalValue: 180,
      },
    ]);
  });

  it("maps the summary fields correctly", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope({
          summary: {
            total_units: 56,
            total_stock_value: 560,
            company_out_of_stock_products: 2,
            network_out_of_stock_products: 1,
          },
        }),
      ),
    );

    const result = await fetchStockOverview();

    expect(result.summary).toEqual({
      totalUnits: 56,
      totalStockValue: 560,
      companyOutOfStockProducts: 2,
      networkOutOfStockProducts: 1,
    });
  });

  it("preserves every holder quantity/value field independently, without deriving or dropping any", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope({
          products: [
            {
              product_id: 44,
              operator: "ORANGE",
              name: "Orange 10dh",
              value: 10,
              company_quantity: 10,
              manager_quantity: 10,
              commercial_quantity: 0,
              total_quantity: 20,
              company_value: 100,
              manager_value: 100,
              commercial_value: 0,
              total_value: 200,
            },
          ],
        }),
      ),
    );

    const result = await fetchStockOverview();
    const [product] = result.products;

    expect(product.companyQuantity).toBe(10);
    expect(product.managerQuantity).toBe(10);
    expect(product.commercialQuantity).toBe(0);
    expect(product.totalQuantity).toBe(20);
    expect(product.companyValue).toBe(100);
    expect(product.managerValue).toBe(100);
    expect(product.commercialValue).toBe(0);
    expect(product.totalValue).toBe(200);
  });

  it("types the operator field using the existing domain Operator vocabulary (IAM|INWI|ORANGE)", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope({
          products: [
            {
              product_id: 2,
              operator: "INWI",
              name: "INWI 10dh",
              value: 10,
              company_quantity: 0,
              manager_quantity: 0,
              commercial_quantity: 0,
              total_quantity: 0,
              company_value: 0,
              manager_value: 0,
              commercial_value: 0,
              total_value: 0,
            },
          ],
        }),
      ),
    );

    const result = await fetchStockOverview();

    expect(["IAM", "INWI", "ORANGE"]).toContain(result.products[0].operator);
    expect(result.products[0].operator).toBe("INWI");
  });

  it("maps an empty dataset to empty products and zeroed summary, without inventing rows", async () => {
    server.use(
      overviewHandler({
        products: [],
        summary: {
          total_units: 0,
          total_stock_value: 0,
          company_out_of_stock_products: 0,
          network_out_of_stock_products: 0,
        },
      }),
    );

    const result = await fetchStockOverview();

    expect(result.products).toEqual([]);
    expect(result.summary).toEqual({
      totalUnits: 0,
      totalStockValue: 0,
      companyOutOfStockProducts: 0,
      networkOutOfStockProducts: 0,
    });
  });

  it("requests the exact endpoint, no query params, no envelope unwrapping", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/stock`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(overviewEnvelope());
      }),
    );

    await fetchStockOverview();

    expect(url?.pathname).toBe("/api/v1/admin/stock");
    expect(url?.search).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { fetchStockMovements } from "./stock-movements-api";
import { STOCK_MOVEMENT_LIST_DEFAULTS } from "../model/stock-movement";

const API = "http://localhost/api/v1";

/**
 * A plain, no-React unit test of the mapper — mirrors
 * `dashboard-statistics-api.test.ts`'s own convention. The envelope shape
 * here is Laravel's RAW, un-wrapped `LengthAwarePaginator::toArray()` —
 * flat `current_page`/`per_page`/`total`/`last_page`, NOT this project's
 * usual `{data, meta: {...}}` shape — verified fresh from this session's
 * own backend test assertions (`AdminStockMovementsHttpTest.php`).
 */
function movementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 61,
    created_at: "2026-08-15T12:46:42+01:00",
    movement_type: "agent_allocation",
    movement_type_label: "Company → Manager (Allocation)",
    status: "validated",
    quantity: 10,
    product: { id: 44, name: "Orange 10dh", operator: "ORANGE", value: 10 },
    source: { type: "company", id: 3, label: "Miza HQ" },
    destination: { type: "agent", id: 12, label: "Bennani Youssef (manager)" },
    actor: null,
    reference: { type: "allocation", id: 7 },
    ...overrides,
  };
}

function flatPaginator(overrides: Record<string, unknown> = {}) {
  return {
    current_page: 1,
    data: [movementRow()],
    per_page: 15,
    total: 16,
    last_page: 2,
    // Fields this app never consumes — present on the real wire, must be
    // safely ignored, not required by the mapper.
    first_page_url: "http://localhost/api/v1/admin/stock/movements?page=1",
    from: 1,
    last_page_url: "http://localhost/api/v1/admin/stock/movements?page=2",
    links: [],
    next_page_url: "http://localhost/api/v1/admin/stock/movements?page=2",
    path: "http://localhost/api/v1/admin/stock/movements",
    prev_page_url: null,
    to: 15,
    ...overrides,
  };
}

function movementsHandler(envelope: ReturnType<typeof flatPaginator>) {
  return http.get(`${API}/admin/stock/movements`, () => HttpResponse.json(envelope));
}

describe("fetchStockMovements — flat paginator normalization", () => {
  it("maps current_page -> page, per_page -> perPage, last_page -> lastPage, total preserved", async () => {
    server.use(
      movementsHandler(
        flatPaginator({ current_page: 2, per_page: 15, total: 16, last_page: 2 }),
      ),
    );

    const result = await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);

    expect(result.page).toBe(2);
    expect(result.perPage).toBe(15);
    expect(result.total).toBe(16);
    expect(result.lastPage).toBe(2);
  });

  it("maps data -> items, one entry per row", async () => {
    server.use(
      movementsHandler(
        flatPaginator({
          data: [movementRow({ id: 1 }), movementRow({ id: 2 })],
          total: 2,
        }),
      ),
    );

    const result = await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
  });

  it("does NOT read a meta object — this is the flat paginator, not {data, meta}", async () => {
    // No `meta` key exists on this envelope at all; a mapper that
    // (incorrectly) reached for `envelope.meta.current_page` would throw
    // here instead of resolving.
    server.use(movementsHandler(flatPaginator()));

    await expect(
      fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS),
    ).resolves.toBeDefined();
  });
});

describe("fetchStockMovements — row mapping", () => {
  it("maps movement_type_label verbatim from the backend, no frontend label mapping", async () => {
    server.use(
      movementsHandler(
        flatPaginator({
          data: [movementRow({ movement_type_label: "Supplier → Company (Intake)" })],
        }),
      ),
    );

    const result = await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);

    expect(result.items[0].movementTypeLabel).toBe("Supplier → Company (Intake)");
  });

  it("maps product/source/destination/reference when present", async () => {
    server.use(movementsHandler(flatPaginator()));

    const result = await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);
    const [item] = result.items;

    expect(item.product).toEqual({
      id: 44,
      name: "Orange 10dh",
      operator: "ORANGE",
      value: 10,
    });
    expect(item.source).toEqual({ type: "company", id: 3, label: "Miza HQ" });
    expect(item.destination).toEqual({
      type: "agent",
      id: 12,
      label: "Bennani Youssef (manager)",
    });
    expect(item.reference).toEqual({ type: "allocation", id: 7 });
  });

  it("handles nullable source/destination/reference/product safely, never fabricating a value", async () => {
    server.use(
      movementsHandler(
        flatPaginator({
          data: [
            movementRow({
              movement_type: "client_sale_reversal",
              movement_type_label: "Sale Cancelled (Restored to Commercial)",
              source: null,
              reference: { type: "invoice", id: 9 },
            }),
          ],
        }),
      ),
    );

    const result = await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);
    const [item] = result.items;

    expect(item.source).toBeNull();
    expect(item.destination).not.toBeNull();
    expect(item.reference).toEqual({ type: "invoice", id: 9 });
  });

  it("handles a null product/destination/reference together, without throwing", async () => {
    server.use(
      movementsHandler(
        flatPaginator({
          data: [
            movementRow({
              movement_type: "adjustment",
              movement_type_label: "Legacy: adjustment",
              product: null,
              destination: null,
              reference: null,
            }),
          ],
        }),
      ),
    );

    const result = await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);
    const [item] = result.items;

    expect(item.product).toBeNull();
    expect(item.destination).toBeNull();
    expect(item.reference).toBeNull();
  });

  it("does not surface an actor field on the mapped domain model", async () => {
    server.use(movementsHandler(flatPaginator()));

    const result = await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);

    expect(result.items[0]).not.toHaveProperty("actor");
  });
});

describe("fetchStockMovements — outgoing query params", () => {
  it("always sends page, and omits every empty/default optional filter", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/stock/movements`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(flatPaginator());
      }),
    );

    await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);

    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.has("type")).toBe(false);
    expect(url?.searchParams.has("operator")).toBe(false);
    expect(url?.searchParams.has("product_id")).toBe(false);
    expect(url?.searchParams.has("from")).toBe(false);
    expect(url?.searchParams.has("to")).toBe(false);
    // Phase 2 uses the backend default per_page — never sent explicitly.
    expect(url?.searchParams.has("per_page")).toBe(false);
  });

  it("sends product_id (snake_case) from params.productId, not productId", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/stock/movements`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(flatPaginator());
      }),
    );

    await fetchStockMovements({ ...STOCK_MOVEMENT_LIST_DEFAULTS, productId: "44" });

    expect(url?.searchParams.get("product_id")).toBe("44");
    expect(url?.searchParams.has("productId")).toBe(false);
  });

  it("sends every populated filter using the approved public wire names", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/stock/movements`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(flatPaginator());
      }),
    );

    await fetchStockMovements({
      page: 2,
      type: "client_sale",
      operator: "IAM",
      productId: "3",
      from: "2026-08-15",
      to: "2026-08-16",
    });

    expect(url?.searchParams.get("page")).toBe("2");
    expect(url?.searchParams.get("type")).toBe("client_sale");
    expect(url?.searchParams.get("operator")).toBe("IAM");
    expect(url?.searchParams.get("product_id")).toBe("3");
    expect(url?.searchParams.get("from")).toBe("2026-08-15");
    expect(url?.searchParams.get("to")).toBe("2026-08-16");
  });

  it("requests the exact endpoint path", async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/admin/stock/movements`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(flatPaginator());
      }),
    );

    await fetchStockMovements(STOCK_MOVEMENT_LIST_DEFAULTS);

    expect(url?.pathname).toBe("/api/v1/admin/stock/movements");
  });
});

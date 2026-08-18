import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { stockMovementsRoutes } from "../routes";
import { StockMovementsListPage } from "./stock-movements-list-page";

const API = "http://localhost/api/v1";
const PATH = "/stock/movements";

const baseUser = {
  id: 1,
  name: "Ahmed Errouissi",
  email: "ahmed@example.com",
  roles: ["admin"],
};

function signInWith(permissions: string[]) {
  sessionManager.__resetForTests();
  sessionManager.start({ token: "tok", user: { ...baseUser, permissions } });
}

/**
 * One raw movement row, exactly as `StockController::movements()` emits it
 * — verified fresh from `AdminStockMovementsHttpTest.php`'s own
 * `test_response_contract_shape`.
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

/** Laravel's raw, flat `LengthAwarePaginator` shape — see the api test's own docblock. */
function flatPaginator(
  rows: ReturnType<typeof movementRow>[],
  meta: Partial<{
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }> = {},
) {
  return {
    current_page: meta.current_page ?? 1,
    data: rows,
    per_page: meta.per_page ?? 15,
    total: meta.total ?? rows.length,
    last_page: meta.last_page ?? 1,
  };
}

function movementsHandler(
  envelope: ReturnType<typeof flatPaginator>,
  onRequest?: (url: URL) => void,
) {
  return http.get(`${API}/admin/stock/movements`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(envelope);
  });
}

function productsHandler() {
  return http.get(`${API}/admin/products`, () =>
    HttpResponse.json([
      { id: 44, name: "Orange 10dh", operator: "ORANGE", value: 10 },
      { id: 45, name: "IAM 20dh", operator: "IAM", value: 20 },
    ]),
  );
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <StockMovementsListPage /> },
      { path: "/stock/bons/:id", element: <p>Bon detail</p> },
      { path: "/stock/allocations/:id", element: <p>Allocation detail</p> },
      { path: "/stock/agent-transfers/:id", element: <p>Transfer detail</p> },
      { path: "/stock/agent-stock-returns/:id", element: <p>Return detail</p> },
      { path: "/grattage/invoices/:id", element: <p>Invoice detail</p> },
    ],
    { initialEntries: [initialPath] },
  );
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([PERMISSIONS.ACCESS_DASHBOARD]);
});

/**
 * Every reachable movement type's label (copied verbatim into the
 * Movement type filter's own options — see the page's module docblock) is
 * ALSO real row content once a movement of that type renders. Asserting
 * on that text with a bare, unscoped `screen.findByText` is ambiguous —
 * and worse, race-prone: the filter's `<option>` exists from the very
 * first render, so an unscoped query can resolve on it before the table
 * (and the real row) ever mounts. Scoping to the rendered `<table>`
 * removes the ambiguity entirely, since no `<option>` lives inside it.
 */
async function findTable() {
  return within(await screen.findByRole("table"));
}

describe("stock movements list — flat-paginator contract", () => {
  it("renders rows mapped from the flat paginator envelope", async () => {
    server.use(movementsHandler(flatPaginator([movementRow()])), productsHandler());
    renderPage();

    const row = await findTable();
    expect(row.getByText("Company → Manager (Allocation)")).toBeInTheDocument();
  });

  it("sends page and omits every empty optional filter, never per_page", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.has("type")).toBe(false);
    expect(url?.searchParams.has("operator")).toBe(false);
    expect(url?.searchParams.has("product_id")).toBe(false);
    expect(url?.searchParams.has("from")).toBe(false);
    expect(url?.searchParams.has("to")).toBe(false);
    expect(url?.searchParams.has("per_page")).toBe(false);
  });

  it("renders a heading", async () => {
    server.use(movementsHandler(flatPaginator([movementRow()])), productsHandler());
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Stock Movements" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state before the first response resolves", async () => {
    server.use(
      http.get(`${API}/admin/stock/movements`, async () => {
        await delay(30);
        return HttpResponse.json(flatPaginator([]));
      }),
      productsHandler(),
    );
    renderPage();

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument(),
    );
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/stock/movements`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
      productsHandler(),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(movementsHandler(flatPaginator([])), productsHandler());
    renderPage();

    expect(await screen.findByText(/no movement yet/i)).toBeInTheDocument();
  });

  it("distinguishes 'no movements at all' from 'none match these filters'", async () => {
    server.use(movementsHandler(flatPaginator([])), productsHandler());
    renderPage(`${PATH}?operator=IAM`);

    expect(
      await screen.findByText(/no movement matches these filters/i),
    ).toBeInTheDocument();
  });
});

describe("mapping the raw row", () => {
  it("displays the backend's own movementTypeLabel verbatim — no frontend label map", async () => {
    server.use(
      movementsHandler(
        flatPaginator([
          movementRow({ movement_type_label: "Supplier → Company (Intake)" }),
        ]),
      ),
      productsHandler(),
    );
    renderPage();

    const row = await findTable();
    expect(row.getByText("Supplier → Company (Intake)")).toBeInTheDocument();
  });

  it("renders product/quantity/status mapped from the backend", async () => {
    server.use(
      movementsHandler(
        flatPaginator([
          movementRow({
            product: { id: 44, name: "Orange 10dh", operator: "ORANGE", value: 10 },
            quantity: 7,
            status: "validated",
          }),
        ]),
      ),
      productsHandler(),
    );
    renderPage();

    expect(await screen.findByText("ORANGE · Orange 10dh")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Validated")).toBeInTheDocument();
  });

  it("renders nullable source/product/reference without crashing", async () => {
    server.use(
      movementsHandler(
        flatPaginator([
          movementRow({
            movement_type: "client_sale_reversal",
            movement_type_label: "Sale Cancelled (Restored to Commercial)",
            source: null,
            product: null,
            reference: null,
          }),
        ]),
      ),
      productsHandler(),
    );
    renderPage();

    const row = await findTable();
    expect(row.getByText("Sale Cancelled (Restored to Commercial)")).toBeInTheDocument();
    // Rendered at all, with dashes for the nullable fields — no crash.
    expect(row.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders a dangling holder (id present, label null) as absent — never fabricating a name", async () => {
    server.use(
      movementsHandler(
        flatPaginator([
          movementRow({ destination: { type: "agent", id: 99, label: null } }),
        ]),
      ),
      productsHandler(),
    );
    renderPage();

    const row = await findTable();
    row.getByText("Company → Manager (Allocation)");
    expect(row.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("filters", () => {
  it("sends the selected operator, resetting the page to its default", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage(`${PATH}?page=2`);
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by operator/i }), {
      target: { value: "IAM" },
    });

    await waitFor(() => expect(url?.searchParams.get("operator")).toBe("IAM"));
    expect(url?.searchParams.get("page")).toBe("1");
  });

  it("sends the selected movement type as `type`, resetting the page to its default", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage(`${PATH}?page=2`);
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by movement type/i }), {
      target: { value: "client_sale" },
    });

    await waitFor(() => expect(url?.searchParams.get("type")).toBe("client_sale"));
    expect(url?.searchParams.get("page")).toBe("1");
  });

  it("sends the selected product as `product_id`, resetting the page to its default", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage(`${PATH}?page=2`);
    await waitFor(() => expect(url).toBeDefined());
    await screen.findByRole("option", { name: "Orange 10dh" });

    fireEvent.change(screen.getByRole("combobox", { name: /filter by product/i }), {
      target: { value: "44" },
    });

    await waitFor(() => expect(url?.searchParams.get("product_id")).toBe("44"));
    expect(url?.searchParams.get("page")).toBe("1");
  });

  it("sends the from/to dates as `from`/`to`, each resetting the page to its default", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage(`${PATH}?page=2`);
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-08-01" },
    });
    await waitFor(() => expect(url?.searchParams.get("from")).toBe("2026-08-01"));
    expect(url?.searchParams.get("page")).toBe("1");

    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-08-31" },
    });
    await waitFor(() => expect(url?.searchParams.get("to")).toBe("2026-08-31"));
  });
});

describe("pagination", () => {
  it("shows the page summary from backend metadata and disables Previous on the first page", async () => {
    server.use(
      movementsHandler(
        flatPaginator([movementRow()], {
          current_page: 1,
          last_page: 3,
          total: 45,
          per_page: 15,
        }),
      ),
      productsHandler(),
    );
    renderPage();

    expect(await screen.findByText("Page 1 of 3 · 45 movements")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("omits the pagination footer entirely for a single page", async () => {
    server.use(
      movementsHandler(flatPaginator([movementRow()], { last_page: 1 })),
      productsHandler(),
    );
    renderPage();

    await findTable();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("advances to page 2 on Next, preserving other filters", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(
        flatPaginator([movementRow()], { current_page: 1, last_page: 2, total: 20 }),
        (u) => (url = u),
      ),
      productsHandler(),
    );
    renderPage(`${PATH}?operator=IAM`);
    await findTable();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(url?.searchParams.get("page")).toBe("2"));
    expect(url?.searchParams.get("operator")).toBe("IAM");
  });
});

describe("inbound product_id drill-down from Stock Overview", () => {
  it("initializes the Product filter from the URL's product_id", async () => {
    server.use(movementsHandler(flatPaginator([movementRow()])), productsHandler());
    renderPage(`${PATH}?product_id=44`);
    await screen.findByRole("option", { name: "Orange 10dh" });

    expect(screen.getByRole("combobox", { name: /filter by product/i })).toHaveValue(
      "44",
    );
  });

  it("requests movements filtered by the inbound product_id", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage(`${PATH}?product_id=44`);

    await waitFor(() => expect(url?.searchParams.get("product_id")).toBe("44"));
  });

  it("does NOT add an operator param alongside the inbound product_id", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage(`${PATH}?product_id=44`);

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.has("operator")).toBe(false);
  });

  it("survives a refresh — the URL alone reconstructs the same params", async () => {
    server.use(movementsHandler(flatPaginator([movementRow()])), productsHandler());
    const router = renderPage(`${PATH}?product_id=44`);

    await findTable();
    expect(router.state.location.search).toBe("?product_id=44");
  });

  it("preserves product_id when another filter changes", async () => {
    let url: URL | undefined;
    server.use(
      movementsHandler(flatPaginator([]), (u) => (url = u)),
      productsHandler(),
    );
    renderPage(`${PATH}?product_id=44`);
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by operator/i }), {
      target: { value: "IAM" },
    });

    await waitFor(() => expect(url?.searchParams.get("operator")).toBe("IAM"));
    expect(url?.searchParams.get("product_id")).toBe("44");
  });

  it("does not crash on an unknown/invalid product_id — it is simply not selected in the picker", async () => {
    server.use(movementsHandler(flatPaginator([movementRow()])), productsHandler());
    renderPage(`${PATH}?product_id=999999`);

    const row = await findTable();
    expect(row.getByText("Company → Manager (Allocation)")).toBeInTheDocument();
  });
});

describe("reference navigation", () => {
  it.each([
    ["bon", "/stock/bons/7", "Bon detail"],
    ["allocation", "/stock/allocations/7", "Allocation detail"],
    ["transfer", "/stock/agent-transfers/7", "Transfer detail"],
    ["return", "/stock/agent-stock-returns/7", "Return detail"],
    ["invoice", "/grattage/invoices/7", "Invoice detail"],
  ] as const)(
    "navigates to the %s reference's existing detail route",
    async (type, path, placeholderText) => {
      server.use(
        movementsHandler(flatPaginator([movementRow({ reference: { type, id: 7 } })])),
        productsHandler(),
      );
      const router = renderPage();

      fireEvent.click(await screen.findByRole("button", { name: new RegExp(type, "i") }));

      await waitFor(() => expect(router.state.location.pathname).toBe(path));
      expect(await screen.findByText(placeholderText)).toBeInTheDocument();
    },
  );

  it("renders plain text, not a link, when reference is absent", async () => {
    server.use(
      movementsHandler(flatPaginator([movementRow({ reference: null })])),
      productsHandler(),
    );
    renderPage();

    await findTable();
    expect(
      screen.queryByRole("button", {
        name: /bon #|allocation #|transfer #|return #|invoice #/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("renders plain text, not a link, for an unrecognized reference type — never guesses a route", async () => {
    server.use(
      movementsHandler(
        flatPaginator([
          movementRow({ reference: { type: "unknown_future_type", id: 3 } }),
        ]),
      ),
      productsHandler(),
    );
    renderPage();

    expect(await screen.findByText("unknown_future_type #3")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /unknown_future_type/i }),
    ).not.toBeInTheDocument();
  });

  it("does not make the entire row clickable — only the Reference cell is a button", async () => {
    server.use(movementsHandler(flatPaginator([movementRow()])), productsHandler());
    renderPage();

    await findTable();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("route permission", () => {
  it("is gated on ACCESS_DASHBOARD, per the route contribution", () => {
    expect(stockMovementsRoutes[0].handle).toMatchObject({
      permission: PERMISSIONS.ACCESS_DASHBOARD,
    });
  });
});

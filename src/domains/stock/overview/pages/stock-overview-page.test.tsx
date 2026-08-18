import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { StockOverviewPage } from "./stock-overview-page";

const API = "http://localhost/api/v1";
const PATH = "/stock/overview";

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

/** `StockService::aggregateInventory()`'s own row shape, verified fresh from source. */
function productRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
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
    ...overrides,
  };
}

function overviewEnvelope(
  products: ReturnType<typeof productRow>[],
  summary: Partial<{
    total_units: number;
    total_stock_value: number;
    company_out_of_stock_products: number;
    network_out_of_stock_products: number;
  }> = {},
) {
  return {
    products,
    summary: {
      total_units: summary.total_units ?? 0,
      total_stock_value: summary.total_stock_value ?? 0,
      company_out_of_stock_products: summary.company_out_of_stock_products ?? 0,
      network_out_of_stock_products: summary.network_out_of_stock_products ?? 0,
    },
  };
}

function overviewHandler(envelope: ReturnType<typeof overviewEnvelope>) {
  return http.get(`${API}/admin/stock`, () => HttpResponse.json(envelope));
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <StockOverviewPage /> },
      // A placeholder stub for Phase 2C's own future route — mirrors
      // `bons-list-page.test.tsx`'s own precedent of stubbing a sibling
      // route this page navigates to but does not itself render.
      { path: "/stock/movements", element: <p>Movements placeholder</p> },
    ],
    { initialEntries: [PATH] },
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
  signInWith(["access-dashboard"]);
});

describe("StockOverviewPage — loading and error", () => {
  it("shows the loading state before data resolves", () => {
    server.use(
      http.get(`${API}/admin/stock`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json(overviewEnvelope([]));
      }),
    );
    renderPage();

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows a generic error with retry on a server failure", async () => {
    server.use(
      http.get(`${API}/admin/stock`, () =>
        HttpResponse.json({ message: "Server error" }, { status: 500 }),
      ),
    );
    renderPage();

    expect(
      await screen.findByText(/stock overview could not be loaded/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("StockOverviewPage — summary cards", () => {
  it("renders all four summary metrics from the backend response", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope([productRow()], {
          total_units: 56,
          total_stock_value: 560,
          company_out_of_stock_products: 2,
          network_out_of_stock_products: 1,
        }),
      ),
    );
    renderPage();

    expect(await screen.findByText("Total Units")).toBeInTheDocument();
    expect(screen.getByText("56")).toBeInTheDocument();
    expect(screen.getByText("Total Stock Value")).toBeInTheDocument();
    expect(screen.getByText("Company Out of Stock")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Network Out of Stock")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("uses the money formatter for Total Stock Value", async () => {
    server.use(
      overviewHandler(overviewEnvelope([productRow()], { total_stock_value: 12500 })),
    );
    renderPage();

    expect(await screen.findByText(/12(\s| )500,00(\s| )DH/)).toBeInTheDocument();
  });

  it("summary cards do NOT change when the table filters change", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope(
          [
            productRow({
              product_id: 1,
              operator: "IAM",
              name: "IAM 10dh",
              total_quantity: 5,
            }),
            productRow({
              product_id: 2,
              operator: "ORANGE",
              name: "Orange 10dh",
              total_quantity: 0,
              company_quantity: 0,
              manager_quantity: 0,
              commercial_quantity: 0,
              total_value: 0,
            }),
          ],
          // Deliberately NOT the sum of the two rows above — this is a
          // pure UI-behavior test, not a backend-consistency check; the
          // whole point is that this number must come from `summary`,
          // never be recomputed from the visible rows.
          { total_units: 999, total_stock_value: 180 },
        ),
      ),
    );
    renderPage();

    await screen.findByText("IAM 10dh");
    expect(screen.getByText("999")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by operator/i), {
      target: { value: "ORANGE" },
    });

    // The table narrowed to the Orange row only...
    expect(screen.queryByText("IAM 10dh")).not.toBeInTheDocument();
    expect(screen.getByText("Orange 10dh")).toBeInTheDocument();
    // ...but the network-wide summary total is unchanged.
    expect(screen.getByText("999")).toBeInTheDocument();
  });
});

describe("StockOverviewPage — inventory table", () => {
  it("renders inventory rows with the expected columns", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope([
          productRow({
            operator: "ORANGE",
            name: "Orange 10dh",
            company_quantity: 10,
            manager_quantity: 10,
            commercial_quantity: 0,
            total_quantity: 20,
            total_value: 200,
          }),
        ]),
      ),
    );
    renderPage();

    const row = (await screen.findByText("Orange 10dh")).closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    expect(cells.getByText("ORANGE")).toBeInTheDocument();
    expect(cells.getByText("Orange 10dh")).toBeInTheDocument();
    // Company qty (10) and Manager qty (10) both render "10" — two cells.
    expect(cells.getAllByText("10")).toHaveLength(2);
    expect(cells.getByText("20")).toBeInTheDocument();
  });

  it("does not add company_value/manager_value/commercial_value columns", async () => {
    server.use(overviewHandler(overviewEnvelope([productRow()])));
    renderPage();

    await screen.findByText("IAM 10dh");
    expect(screen.queryByText(/company value/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/manager value/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/commercial value/i)).not.toBeInTheDocument();
  });
});

describe("StockOverviewPage — filters", () => {
  it("filters by operator client-side", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope([
          productRow({ product_id: 1, operator: "IAM", name: "IAM 10dh" }),
          productRow({ product_id: 2, operator: "ORANGE", name: "Orange 10dh" }),
        ]),
      ),
    );
    renderPage();

    await screen.findByText("IAM 10dh");
    expect(screen.getByText("Orange 10dh")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by operator/i), {
      target: { value: "IAM" },
    });

    expect(screen.getByText("IAM 10dh")).toBeInTheDocument();
    expect(screen.queryByText("Orange 10dh")).not.toBeInTheDocument();
  });

  it("filters by out-of-stock state, where out of stock means totalQuantity === 0", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope([
          productRow({ product_id: 1, name: "In stock product", total_quantity: 18 }),
          productRow({
            product_id: 2,
            name: "Out of stock product",
            total_quantity: 0,
            company_quantity: 0,
            manager_quantity: 0,
            commercial_quantity: 0,
            total_value: 0,
          }),
        ]),
      ),
    );
    renderPage();

    await screen.findByText("In stock product");
    expect(screen.getByText("Out of stock product")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by stock state/i), {
      target: { value: "out-of-stock" },
    });

    expect(screen.queryByText("In stock product")).not.toBeInTheDocument();
    expect(screen.getByText("Out of stock product")).toBeInTheDocument();
  });

  it("does not invent a low-stock filter option", async () => {
    server.use(overviewHandler(overviewEnvelope([productRow()])));
    renderPage();

    await screen.findByText("IAM 10dh");
    expect(screen.queryByText(/low stock/i)).not.toBeInTheDocument();
  });
});

describe("StockOverviewPage — empty states", () => {
  it("shows the base empty message when the backend has zero products", async () => {
    server.use(overviewHandler(overviewEnvelope([])));
    renderPage();

    expect(await screen.findByText("No product yet.")).toBeInTheDocument();
  });

  it("shows a filter-specific empty message when filters match zero rows", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope([productRow({ operator: "IAM", name: "IAM 10dh" })]),
      ),
    );
    renderPage();

    await screen.findByText("IAM 10dh");

    fireEvent.change(screen.getByLabelText(/filter by operator/i), {
      target: { value: "ORANGE" },
    });

    expect(
      await screen.findByText("No product matches these filters."),
    ).toBeInTheDocument();
    expect(screen.queryByText("No product yet.")).not.toBeInTheDocument();
  });
});

describe("StockOverviewPage — View movements", () => {
  it("navigates to exactly /stock/movements?product_id=<id>, with no operator param", async () => {
    server.use(
      overviewHandler(
        overviewEnvelope([productRow({ product_id: 44, name: "Orange 10dh" })]),
      ),
    );
    const router = renderPage();

    const row = (await screen.findByText("Orange 10dh")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: /view movements/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/stock/movements");
    });
    expect(router.state.location.search).toBe("?product_id=44");
  });
});

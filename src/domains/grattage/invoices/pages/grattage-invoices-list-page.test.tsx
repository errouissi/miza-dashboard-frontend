import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { GrattageInvoicesListPage } from "./grattage-invoices-list-page";

const API = "http://localhost/api/v1";
const PATH = "/grattage/invoices";

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
 * One raw `GrattageInvoice` model row, exactly as `GrattageInvoiceController
 * ::index` emits it (verified from source — no Resource class, no
 * `transform()`): `agent`/`client` are unrestricted nested models, only the
 * consumed fields are typed here (ADR-0008).
 */
function invoiceRow(
  id: number,
  overrides: Partial<{
    status: "pending" | "overdue" | "settled" | "cancelled";
    total_amount: string;
    sold_at: string;
    due_at: string;
    declared_at: string | null;
    deposit_id: number | null;
    agent: { id: number; nom: string; prenom: string; num_compte: string };
    client: { id: number; phone: string };
  }> = {},
) {
  return {
    id,
    status: "pending" as const,
    total_amount: "150.00",
    sold_at: "2026-08-01T09:00:00.000000Z",
    due_at: "2026-08-02T12:00:00.000000Z",
    declared_at: null,
    deposit_id: null,
    agent: { id: 1, nom: "Alaoui", prenom: "Sara", num_compte: "CM0001" },
    client: { id: 1, phone: "0600100001" },
    ...overrides,
  };
}

/** The flat-paginator envelope this endpoint returns — same shape Clients' own `index()` uses. */
function pageEnvelope(
  rows: ReturnType<typeof invoiceRow>[],
  meta: Partial<{
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }> = {},
) {
  return {
    success: true,
    data: {
      data: rows,
      current_page: meta.current_page ?? 1,
      per_page: meta.per_page ?? 15,
      total: meta.total ?? rows.length,
      last_page: meta.last_page ?? 1,
    },
  };
}

function invoicesHandler(
  rows: ReturnType<typeof invoiceRow>[],
  onRequest?: (url: URL) => void,
  meta?: Parameters<typeof pageEnvelope>[1],
) {
  return http.get(`${API}/admin/grattage-invoices`, ({ request }) => {
    onRequest?.(new URL(request.url));
    return HttpResponse.json(pageEnvelope(rows, meta));
  });
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <GrattageInvoicesListPage /> },
      { path: "/grattage/invoices/:id", element: <p>Grattage invoice detail</p> },
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

describe("grattage invoices list — flat-paginator contract", () => {
  it("renders rows from the {success, data: {data, current_page, ...}} envelope", async () => {
    server.use(
      invoicesHandler([
        invoiceRow(1, {
          agent: { id: 1, nom: "Alaoui", prenom: "Sara", num_compte: "CM0001" },
        }),
        invoiceRow(2, {
          agent: { id: 2, nom: "Tazi", prenom: "Nadia", num_compte: "CM0002" },
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByText("Sara Alaoui")).toBeInTheDocument();
    expect(screen.getByText("Nadia Tazi")).toBeInTheDocument();
  });

  it("sends only page and the three supported filters — never a search param", async () => {
    let url: URL | undefined;
    server.use(invoicesHandler([], (u) => (url = u)));
    renderPage();

    await waitFor(() => expect(url).toBeDefined());
    expect(url?.searchParams.get("page")).toBe("1");
    expect(url?.searchParams.get("search")).toBeNull();
    expect(url?.searchParams.get("status")).toBeNull();
    expect(url?.searchParams.get("date_from")).toBeNull();
    expect(url?.searchParams.get("date_to")).toBeNull();
  });

  it("renders a heading", async () => {
    server.use(invoicesHandler([invoiceRow(1)]));
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Grattage Invoices" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state before the first response resolves", async () => {
    server.use(
      http.get(`${API}/admin/grattage-invoices`, async () => {
        await delay(30);
        return HttpResponse.json(pageEnvelope([]));
      }),
    );
    renderPage();

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument(),
    );
  });

  it("shows an empty state rather than an empty table", async () => {
    server.use(invoicesHandler([]));
    renderPage();

    expect(await screen.findByText(/no grattage invoice yet/i)).toBeInTheDocument();
  });

  it("distinguishes 'no invoices' from 'none match these filters'", async () => {
    server.use(invoicesHandler([]));
    renderPage(`${PATH}?status=settled`);

    expect(
      await screen.findByText(/no grattage invoice matches these filters/i),
    ).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/grattage-invoices`, () =>
        HttpResponse.json({ success: false, message: "boom" }, { status: 500 }),
      ),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("mapping the raw row", () => {
  it("renders totalAmount verbatim with a DH suffix, never through MoneyAmount formatting", async () => {
    server.use(invoicesHandler([invoiceRow(1, { total_amount: "1500.00" })]));
    renderPage();

    // Verbatim, not Moroccan-grouped — "1500.00 DH", not "1 500,00 DH".
    expect(await screen.findByText("1500.00 DH")).toBeInTheDocument();
  });

  it("reduces the nested agent object to a display name", async () => {
    server.use(
      invoicesHandler([
        invoiceRow(1, {
          agent: { id: 9, nom: "Chraibi", prenom: "Omar", num_compte: "CM0009" },
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByText("Omar Chraibi")).toBeInTheDocument();
  });

  it("renders the client's phone — clients have no name field", async () => {
    server.use(
      invoicesHandler([invoiceRow(1, { client: { id: 4, phone: "0600100099" } })]),
    );
    renderPage();

    expect(await screen.findByText("0600100099")).toBeInTheDocument();
  });

  it.each([
    ["pending", "Pending"],
    ["overdue", "Overdue"],
    ["settled", "Settled"],
    ["cancelled", "Cancelled"],
  ] as const)(
    "renders status %s with its domain-owned label %s",
    async (status, label) => {
      server.use(invoicesHandler([invoiceRow(1, { status })]));
      renderPage();

      expect(await screen.findByText(label)).toBeInTheDocument();
    },
  );
});

describe("filters", () => {
  it("sends the selected status as `status`, resetting the page to its default", async () => {
    let url: URL | undefined;
    server.use(invoicesHandler([], (u) => (url = u)));
    renderPage(`${PATH}?page=2`);
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByRole("combobox", { name: /filter by status/i }), {
      target: { value: "overdue" },
    });

    await waitFor(() => expect(url?.searchParams.get("status")).toBe("overdue"));
    expect(url?.searchParams.get("page")).toBe("1");
  });

  it("sends the from/to dates as `date_from`/`date_to`", async () => {
    let url: URL | undefined;
    server.use(invoicesHandler([], (u) => (url = u)));
    renderPage();
    await waitFor(() => expect(url).toBeDefined());

    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-08-01" },
    });
    await waitFor(() => expect(url?.searchParams.get("date_from")).toBe("2026-08-01"));

    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-08-31" },
    });
    await waitFor(() => expect(url?.searchParams.get("date_to")).toBe("2026-08-31"));
  });
});

describe("pagination", () => {
  it("shows the page summary and disables Previous on the first page", async () => {
    server.use(
      invoicesHandler([invoiceRow(1)], undefined, {
        current_page: 1,
        last_page: 3,
        total: 45,
        per_page: 15,
      }),
    );
    renderPage();

    expect(await screen.findByText("Page 1 of 3 · 45 invoices")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("omits the pagination footer entirely for a single page", async () => {
    server.use(invoicesHandler([invoiceRow(1)], undefined, { last_page: 1 }));
    renderPage();

    await screen.findByText("Sara Alaoui");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });
});

describe("navigation to the detail page", () => {
  it("navigates to the invoice's detail route on View", async () => {
    server.use(invoicesHandler([invoiceRow(7)]));
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/grattage/invoices/7"),
    );
  });
});

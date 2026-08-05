import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { BonsListPage } from "./bons-list-page";

const API = "http://localhost/api/v1";
const PATH = "/stock/bons";
const NEW_PATH = "/stock/bons/new";
const DETAIL_PATH = "/stock/bons/:id";

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

/** `BonResource`'s own row shape, verified fresh from source. */
function row(
  id: number,
  overrides: Partial<{
    bon_number: string;
    status: "draft" | "validated" | "cancelled";
    montant: string;
    received_at: string | null;
    supplier: { id: number; name: string } | null;
    company: { id: number; name: string } | null;
  }> = {},
) {
  return {
    id,
    bon_number: `BON-${id.toString().padStart(3, "0")}`,
    status: "draft" as const,
    montant: "150.00",
    notes: null,
    supplier_id: 7,
    company_id: 5,
    evidence_url: "http://localhost/storage/bons/2026/08/supplier_7/evidence.pdf",
    evidence_name: "evidence.pdf",
    received_at: "2026-08-01",
    approved_by: null,
    approved_at: null,
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "2026-08-01T09:00:00Z",
    updated_at: "2026-08-01T09:00:00Z",
    supplier: { id: 7, name: "Default Supplier" },
    company: { id: 5, name: "Miza" },
    creator: { id: 1, name: "Ahmed Errouissi" },
    approver: null,
    ...overrides,
  };
}

function listEnvelope(
  rows: ReturnType<typeof row>[],
  meta: Partial<{
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  }> = {},
) {
  return {
    data: rows,
    links: { first: null, last: null, prev: null, next: null },
    meta: {
      current_page: meta.current_page ?? 1,
      per_page: meta.per_page ?? 15,
      total: meta.total ?? rows.length,
      last_page: meta.last_page ?? 1,
    },
  };
}

function listHandler(envelope: ReturnType<typeof listEnvelope>) {
  return http.get(`${API}/admin/bons`, () => HttpResponse.json(envelope));
}

function suppliersHandler() {
  return http.get(`${API}/admin/suppliers`, () =>
    HttpResponse.json([
      { id: 7, name: "Default Supplier", code: "DEFAULT", active: true },
    ]),
  );
}

function companiesHandler() {
  return http.get(`${API}/admin/companies`, () =>
    HttpResponse.json([{ id: 5, name: "Miza", code: "MIZA", active: true }]),
  );
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <BonsListPage /> },
      { path: NEW_PATH, element: <p>Create bon</p> },
      { path: DETAIL_PATH, element: <p>Bon detail</p> },
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
  signInWith([
    PERMISSIONS.VIEW_BONS,
    PERMISSIONS.CREATE_BON,
    PERMISSIONS.ACCESS_DASHBOARD,
  ]);
});

describe("rendering — Laravel resource-collection contract", () => {
  it("renders rows from the {data, links, meta} envelope", async () => {
    server.use(
      listHandler(listEnvelope([row(1)])),
      suppliersHandler(),
      companiesHandler(),
    );
    renderPage();

    expect(await screen.findByText("BON-001")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Default Supplier")).toBeInTheDocument();
    expect(table.getByText("Miza")).toBeInTheDocument();
    expect(table.getByText("150.00 DH")).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/bons`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      suppliersHandler(),
      companiesHandler(),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no bons", async () => {
    server.use(listHandler(listEnvelope([])), suppliersHandler(), companiesHandler());
    renderPage();

    expect(await screen.findByText("No bon yet.")).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("sends the selected status as `status`", async () => {
    let requestedStatus: string | null = null;
    server.use(
      http.get(`${API}/admin/bons`, ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      suppliersHandler(),
      companiesHandler(),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText(/^status$/i), {
      target: { value: "validated" },
    });

    await waitFor(() => expect(requestedStatus).toBe("validated"));
  });

  it("sends the selected supplier as `supplier_id`", async () => {
    let requestedSupplierId: string | null = null;
    server.use(
      http.get(`${API}/admin/bons`, ({ request }) => {
        requestedSupplierId = new URL(request.url).searchParams.get("supplier_id");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      suppliersHandler(),
      companiesHandler(),
    );
    renderPage();

    const supplierSelect = await screen.findByLabelText(/^supplier$/i);
    await within(supplierSelect).findByRole("option", { name: "Default Supplier" });
    fireEvent.change(supplierSelect, { target: { value: "7" } });

    await waitFor(() => expect(requestedSupplierId).toBe("7"));
  });

  it("sends the selected company as `company_id`", async () => {
    let requestedCompanyId: string | null = null;
    server.use(
      http.get(`${API}/admin/bons`, ({ request }) => {
        requestedCompanyId = new URL(request.url).searchParams.get("company_id");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      suppliersHandler(),
      companiesHandler(),
    );
    renderPage();

    const companySelect = await screen.findByLabelText(/^company$/i);
    await within(companySelect).findByRole("option", { name: "Miza" });
    fireEvent.change(companySelect, { target: { value: "5" } });

    await waitFor(() => expect(requestedCompanyId).toBe("5"));
  });
});

describe("permission gating", () => {
  it("shows the Record Bon button when the operator holds create-bon", async () => {
    server.use(listHandler(listEnvelope([])), suppliersHandler(), companiesHandler());
    renderPage();

    expect(await screen.findByRole("button", { name: "Record Bon" })).toBeInTheDocument();
  });

  it("hides the Record Bon button without create-bon", async () => {
    signInWith([PERMISSIONS.VIEW_BONS]);
    server.use(listHandler(listEnvelope([])), suppliersHandler(), companiesHandler());
    renderPage();

    await screen.findByText("No bon yet.");
    expect(screen.queryByRole("button", { name: "Record Bon" })).not.toBeInTheDocument();
  });

  it("navigates to the create route on click", async () => {
    server.use(listHandler(listEnvelope([])), suppliersHandler(), companiesHandler());
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Record Bon" }));

    expect(router.state.location.pathname).toBe(NEW_PATH);
  });
});

describe("navigation", () => {
  it("View navigates to the bon's own detail page", async () => {
    server.use(
      listHandler(listEnvelope([row(1)])),
      suppliersHandler(),
      companiesHandler(),
    );
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    expect(router.state.location.pathname).toBe("/stock/bons/1");
  });
});

describe("pagination", () => {
  it("shows no footer when there is only one page", async () => {
    server.use(
      listHandler(listEnvelope([row(1)], { last_page: 1 })),
      suppliersHandler(),
      companiesHandler(),
    );
    renderPage();

    await screen.findByText("BON-001");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("advances to the next page and requests page=2", async () => {
    let requestedPage: string | null = null;
    server.use(
      http.get(`${API}/admin/bons`, ({ request }) => {
        requestedPage = new URL(request.url).searchParams.get("page");
        return HttpResponse.json(
          listEnvelope([row(1)], {
            current_page: requestedPage === "2" ? 2 : 1,
            last_page: 2,
            total: 2,
          }),
        );
      }),
      suppliersHandler(),
      companiesHandler(),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => expect(requestedPage).toBe("2"));
  });
});

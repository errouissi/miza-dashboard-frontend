import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AllocationsListPage } from "./allocations-list-page";

const API = "http://localhost/api/v1";
const PATH = "/stock/allocations";
const NEW_PATH = "/stock/allocations/new";
const DETAIL_PATH = "/stock/allocations/:id";

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

/** `AllocationResource`'s own row shape, verified fresh from source. */
function row(
  id: number,
  overrides: Partial<{
    allocation_number: string;
    status: "draft" | "validated" | "cancelled";
    montant: string;
    created_at: string;
    company: { id: number; name: string } | null;
    agent: { id: number; nom: string; prenom: string } | null;
  }> = {},
) {
  return {
    id,
    allocation_number: `ALL-${id.toString().padStart(3, "0")}`,
    status: "draft" as const,
    montant: "150.00",
    notes: null,
    company_id: 5,
    agent_id: 20,
    admin_id: 1,
    approved_by: null,
    approved_at: null,
    cancelled_by: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: "2026-07-25T09:00:00Z",
    updated_at: "2026-07-25T09:00:00Z",
    company: { id: 5, name: "Miza" },
    agent: { id: 20, nom: "Bennani", prenom: "Youssef" },
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
  return http.get(`${API}/admin/allocations`, () => HttpResponse.json(envelope));
}

function managersHandler() {
  return http.get(`${API}/admin/agents/managers`, () =>
    HttpResponse.json({
      success: true,
      data: {
        data: [{ id: 20, nom: "Bennani", prenom: "Youssef", status: "active" }],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    }),
  );
}

/** `CompanyController::index`'s own flat array, no envelope. */
function companiesHandler() {
  return http.get(`${API}/admin/companies`, () =>
    HttpResponse.json([{ id: 5, name: "Miza", code: "MIZA", active: true }]),
  );
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <AllocationsListPage /> },
      { path: NEW_PATH, element: <p>Create allocation</p> },
      { path: DETAIL_PATH, element: <p>Allocation detail</p> },
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
    PERMISSIONS.VIEW_ALLOCATIONS,
    PERMISSIONS.CREATE_ALLOCATION,
    PERMISSIONS.VIEW_AGENTS,
    PERMISSIONS.ACCESS_DASHBOARD,
  ]);
});

describe("rendering — Laravel resource-collection contract", () => {
  it("renders rows from the {data, links, meta} envelope", async () => {
    server.use(
      listHandler(listEnvelope([row(1)])),
      managersHandler(),
      companiesHandler(),
    );
    renderPage();

    expect(await screen.findByText("ALL-001")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Miza")).toBeInTheDocument();
    expect(table.getByText("Youssef Bennani")).toBeInTheDocument();
    expect(table.getByText("150.00 DH")).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/allocations`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      managersHandler(),
      companiesHandler(),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no allocations", async () => {
    server.use(listHandler(listEnvelope([])), managersHandler(), companiesHandler());
    renderPage();

    expect(await screen.findByText("No allocation yet.")).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("sends the selected status as `status`", async () => {
    let requestedStatus: string | null = null;
    server.use(
      http.get(`${API}/admin/allocations`, ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      managersHandler(),
      companiesHandler(),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText(/^status$/i), {
      target: { value: "validated" },
    });

    await waitFor(() => expect(requestedStatus).toBe("validated"));
  });

  it("sends the selected manager as `agent_id`", async () => {
    let requestedAgentId: string | null = null;
    server.use(
      http.get(`${API}/admin/allocations`, ({ request }) => {
        requestedAgentId = new URL(request.url).searchParams.get("agent_id");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      managersHandler(),
      companiesHandler(),
    );
    renderPage();

    const managerSelect = await screen.findByLabelText(/^manager$/i);
    await within(managerSelect).findByRole("option", { name: "Youssef Bennani" });
    fireEvent.change(managerSelect, { target: { value: "20" } });

    await waitFor(() => expect(requestedAgentId).toBe("20"));
  });

  it("sends the selected company as `company_id` — the NEW third filter Return/Transfer never needed", async () => {
    let requestedCompanyId: string | null = null;
    server.use(
      http.get(`${API}/admin/allocations`, ({ request }) => {
        requestedCompanyId = new URL(request.url).searchParams.get("company_id");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      managersHandler(),
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
  it("shows the Record Allocation button when the operator holds create-allocation", async () => {
    server.use(listHandler(listEnvelope([])), managersHandler(), companiesHandler());
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Record Allocation" }),
    ).toBeInTheDocument();
  });

  it("hides the Record Allocation button without create-allocation", async () => {
    signInWith([PERMISSIONS.VIEW_ALLOCATIONS]);
    server.use(listHandler(listEnvelope([])), managersHandler(), companiesHandler());
    renderPage();

    await screen.findByText("No allocation yet.");
    expect(
      screen.queryByRole("button", { name: "Record Allocation" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to the create route on click", async () => {
    server.use(listHandler(listEnvelope([])), managersHandler(), companiesHandler());
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Record Allocation" }));

    expect(router.state.location.pathname).toBe(NEW_PATH);
  });
});

describe("navigation", () => {
  it("View navigates to the allocation's own detail page", async () => {
    server.use(
      listHandler(listEnvelope([row(1)])),
      managersHandler(),
      companiesHandler(),
    );
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    expect(router.state.location.pathname).toBe("/stock/allocations/1");
  });
});

describe("pagination", () => {
  it("shows no footer when there is only one page", async () => {
    server.use(
      listHandler(listEnvelope([row(1)], { last_page: 1 })),
      managersHandler(),
      companiesHandler(),
    );
    renderPage();

    await screen.findByText("ALL-001");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("advances to the next page and requests page=2", async () => {
    let requestedPage: string | null = null;
    server.use(
      http.get(`${API}/admin/allocations`, ({ request }) => {
        requestedPage = new URL(request.url).searchParams.get("page");
        return HttpResponse.json(
          listEnvelope([row(1)], {
            current_page: requestedPage === "2" ? 2 : 1,
            last_page: 2,
            total: 2,
          }),
        );
      }),
      managersHandler(),
      companiesHandler(),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => expect(requestedPage).toBe("2"));
  });
});

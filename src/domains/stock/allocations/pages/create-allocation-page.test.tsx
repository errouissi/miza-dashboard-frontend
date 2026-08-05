import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { CreateAllocationPage } from "./create-allocation-page";

const API = "http://localhost/api/v1";
const PATH = "/stock/allocations/new";
const ALLOCATIONS_PATH = "/stock/allocations";
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

/** `CompanyController::index`'s own flat array, no envelope. */
function companiesHandler() {
  return http.get(`${API}/admin/companies`, () =>
    HttpResponse.json([{ id: 5, name: "Miza", code: "MIZA", active: true }]),
  );
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

/**
 * `store()`'s own flat envelope — `{"data": new AllocationResource(...)}`.
 * `allocation_number` is BACKEND-GENERATED now (`AllocationService::
 * createDraft` via `DocumentNumberService`) — this fixture value stands in
 * for whatever the server actually returns; the create form never sends
 * one.
 */
const CREATE_ALLOCATION_ENVELOPE = {
  data: {
    id: 900,
    allocation_number: "ALLOC-01J8Z9XQ7K",
    status: "draft",
    montant: "0.00",
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
  },
};

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <CreateAllocationPage /> },
      { path: ALLOCATIONS_PATH, element: <p>Allocations list</p> },
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

async function selectCompanyAndManager() {
  const companySelect = await screen.findByLabelText("Company");
  await within(companySelect).findByRole("option", { name: "Miza" });
  fireEvent.change(companySelect, { target: { value: "5" } });

  const managerSelect = await screen.findByLabelText("Manager");
  await within(managerSelect).findByRole("option", { name: "Youssef Bennani" });
  fireEvent.change(managerSelect, { target: { value: "20" } });
}

beforeEach(() => {
  window.localStorage.clear();
  signInWith([
    PERMISSIONS.CREATE_ALLOCATION,
    PERMISSIONS.VIEW_AGENTS,
    PERMISSIONS.ACCESS_DASHBOARD,
  ]);
});

describe("rendering", () => {
  it("renders the backend-supported fields — two independent selects, no cascade, no allocation number input", async () => {
    server.use(companiesHandler(), managersHandler());
    renderPage();

    expect(await screen.findByLabelText("Company")).toBeInTheDocument();
    expect(screen.getByLabelText("Manager")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Allocation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    // No allocation number field — it is backend-generated now, and no
    // date field — StoreAllocationRequest has none, unlike Transfer's own.
    expect(screen.queryByLabelText(/allocation number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/date/i)).not.toBeInTheDocument();
  });

  it("does NOT disable the Manager select while no company is chosen — the two selects are independent, unlike Return's/Transfer's cascade", async () => {
    server.use(companiesHandler(), managersHandler());
    renderPage();

    await screen.findByLabelText("Company");
    expect(screen.getByLabelText("Manager")).toBeEnabled();
  });

  it("offers only active companies (the endpoint's own server-side filter)", async () => {
    server.use(
      http.get(`${API}/admin/companies`, () =>
        HttpResponse.json([{ id: 5, name: "Miza", code: "MIZA", active: true }]),
      ),
      managersHandler(),
    );
    renderPage();

    const companySelect = await screen.findByLabelText("Company");
    expect(
      await within(companySelect).findByRole("option", { name: "Miza" }),
    ).toBeInTheDocument();
  });

  it("requests only ACTIVE managers — `status=active`, not the list filter's unfiltered picker", async () => {
    let requestedStatus: string | null = null;
    server.use(
      companiesHandler(),
      http.get(`${API}/admin/agents/managers`, ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({
          success: true,
          data: {
            data: [{ id: 20, nom: "Bennani", prenom: "Youssef", status: "active" }],
            current_page: 1,
            per_page: 100,
            total: 1,
            last_page: 1,
          },
        });
      }),
    );
    renderPage();

    await screen.findByLabelText("Manager");
    await waitFor(() => expect(requestedStatus).toBe("active"));
  });
});

describe("validation", () => {
  it("shows a required error for both remaining fields on an empty submit", async () => {
    server.use(companiesHandler(), managersHandler());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Record Allocation" }));

    expect(await screen.findByText("Company is required.")).toBeInTheDocument();
    expect(screen.getByText("Manager is required.")).toBeInTheDocument();
  });
});

describe("submission and success", () => {
  it("submits the exact wire field names — no allocation_number, the backend generates it", async () => {
    let body: unknown;
    server.use(
      companiesHandler(),
      managersHandler(),
      http.post(`${API}/admin/allocations`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(CREATE_ALLOCATION_ENVELOPE, { status: 201 });
      }),
    );
    renderPage();

    await selectCompanyAndManager();
    fireEvent.click(screen.getByRole("button", { name: "Record Allocation" }));

    await waitFor(() =>
      expect(body).toEqual({
        company_id: "5",
        agent_id: "20",
      }),
    );
  });

  it("includes notes only when filled in", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      companiesHandler(),
      managersHandler(),
      http.post(`${API}/admin/allocations`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(CREATE_ALLOCATION_ENVELOPE, { status: 201 });
      }),
    );
    renderPage();

    await selectCompanyAndManager();
    fireEvent.change(screen.getByLabelText("Notes"), {
      target: { value: "Q3 restock" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record Allocation" }));

    await waitFor(() => expect(body.notes).toBe("Q3 restock"));
  });

  it("navigates to the new allocation's own detail page on success", async () => {
    server.use(
      companiesHandler(),
      managersHandler(),
      http.post(`${API}/admin/allocations`, () =>
        HttpResponse.json(CREATE_ALLOCATION_ENVELOPE, { status: 201 }),
      ),
    );
    const router = renderPage();

    await selectCompanyAndManager();
    fireEvent.click(screen.getByRole("button", { name: "Record Allocation" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/stock/allocations/900"),
    );
  });
});

describe("Cancel", () => {
  it("navigates to the list without submitting", async () => {
    let called = false;
    server.use(
      companiesHandler(),
      managersHandler(),
      http.post(`${API}/admin/allocations`, () => {
        called = true;
        return HttpResponse.json(CREATE_ALLOCATION_ENVELOPE, { status: 201 });
      }),
    );
    const router = renderPage();

    await screen.findByLabelText("Company");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(router.state.location.pathname).toBe(ALLOCATIONS_PATH);
    expect(called).toBe(false);
  });
});

describe("failure preserves entered values", () => {
  it("shows a general error and does not navigate on a server failure", async () => {
    server.use(
      companiesHandler(),
      managersHandler(),
      http.post(`${API}/admin/allocations`, () =>
        HttpResponse.json({ message: "Server error" }, { status: 500 }),
      ),
    );
    const router = renderPage();

    await selectCompanyAndManager();
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Q3 restock" } });
    fireEvent.click(screen.getByRole("button", { name: "Record Allocation" }));

    expect(
      await screen.findByText(/something went wrong recording this allocation/i),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(PATH);
    expect(screen.getByLabelText("Notes")).toHaveValue("Q3 restock");
  });

  it("shows a permission-specific message on a 403", async () => {
    server.use(
      companiesHandler(),
      managersHandler(),
      http.post(`${API}/admin/allocations`, () =>
        HttpResponse.json(
          { success: false, code: "AUTHORIZATION_DENIED" },
          { status: 403 },
        ),
      ),
    );
    renderPage();

    await selectCompanyAndManager();
    fireEvent.click(screen.getByRole("button", { name: "Record Allocation" }));

    expect(
      await screen.findByText(/you do not have permission to record an allocation/i),
    ).toBeInTheDocument();
  });
});

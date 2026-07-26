import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { sessionManager } from "@/infrastructure/auth";
import { createQueryClient } from "@/infrastructure/query";
import { PERMISSIONS } from "@/infrastructure/permissions";
import { AgentTransfersListPage } from "./agent-transfers-list-page";

const API = "http://localhost/api/v1";
const PATH = "/stock/agent-transfers";
const NEW_PATH = "/stock/agent-transfers/new";
const DETAIL_PATH = "/stock/agent-transfers/:id";

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

/** `AgentTransferResource`'s own row shape, verified fresh from source. */
function row(
  id: number,
  overrides: Partial<{
    transfer_number: string;
    status: "draft" | "validated" | "cancelled";
    montant: string;
    created_at: string;
    manager: { id: number; nom: string; prenom: string } | null;
    commercial: { id: number; nom: string; prenom: string } | null;
  }> = {},
) {
  return {
    id,
    transfer_number: `TRF-${id.toString().padStart(3, "0")}`,
    status: "draft" as const,
    montant: "150.00",
    notes: null,
    transfer_date: null,
    admin_id: 1,
    manager_id: 20,
    commercial_id: 10,
    approved_by: null,
    approved_at: null,
    created_at: "2026-07-25T09:00:00Z",
    updated_at: "2026-07-25T09:00:00Z",
    creator: { id: 1, name: "Ahmed Errouissi" },
    manager: { id: 20, nom: "Bennani", prenom: "Youssef" },
    commercial: { id: 10, nom: "Alaoui", prenom: "Sara" },
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
  return http.get(`${API}/admin/agent-transfers`, () => HttpResponse.json(envelope));
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

function commercialsHandler() {
  return http.get(`${API}/admin/agents/commercials`, () =>
    HttpResponse.json({
      success: true,
      data: {
        data: [{ id: 10, nom: "Alaoui", prenom: "Sara", status: "active" }],
        current_page: 1,
        per_page: 100,
        total: 1,
        last_page: 1,
      },
    }),
  );
}

function renderPage(initialPath: string = PATH) {
  const router = createMemoryRouter(
    [
      { path: PATH, element: <AgentTransfersListPage /> },
      { path: NEW_PATH, element: <p>Create transfer</p> },
      { path: DETAIL_PATH, element: <p>Transfer detail</p> },
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
    PERMISSIONS.VIEW_AGENT_TRANSFERS,
    PERMISSIONS.CREATE_AGENT_TRANSFER,
    PERMISSIONS.VIEW_AGENTS,
  ]);
});

describe("rendering — Laravel resource-collection contract", () => {
  it("renders rows from the {data, links, meta} envelope", async () => {
    server.use(
      listHandler(listEnvelope([row(1)])),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    expect(await screen.findByText("TRF-001")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Youssef Bennani")).toBeInTheDocument();
    expect(table.getByText("Sara Alaoui")).toBeInTheDocument();
    expect(table.getByText("150.00 DH")).toBeInTheDocument();
  });

  it("shows the error state with a retry action on a failed load", async () => {
    server.use(
      http.get(`${API}/admin/agent-transfers`, () =>
        HttpResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 }),
      ),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no transfers", async () => {
    server.use(listHandler(listEnvelope([])), managersHandler(), commercialsHandler());
    renderPage();

    expect(await screen.findByText("No transfer yet.")).toBeInTheDocument();
  });
});

describe("filters", () => {
  it("sends the selected status as `status`", async () => {
    let requestedStatus: string | null = null;
    server.use(
      http.get(`${API}/admin/agent-transfers`, ({ request }) => {
        requestedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText(/^status$/i), {
      target: { value: "validated" },
    });

    await waitFor(() => expect(requestedStatus).toBe("validated"));
  });

  it("sends the selected manager as `manager_id`", async () => {
    let requestedManagerId: string | null = null;
    server.use(
      http.get(`${API}/admin/agent-transfers`, ({ request }) => {
        requestedManagerId = new URL(request.url).searchParams.get("manager_id");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    const managerSelect = await screen.findByLabelText(/^manager$/i);
    await within(managerSelect).findByRole("option", { name: "Youssef Bennani" });
    fireEvent.change(managerSelect, { target: { value: "20" } });

    await waitFor(() => expect(requestedManagerId).toBe("20"));
  });

  it("sends the selected commercial as `commercial_id`", async () => {
    let requestedCommercialId: string | null = null;
    server.use(
      http.get(`${API}/admin/agent-transfers`, ({ request }) => {
        requestedCommercialId = new URL(request.url).searchParams.get("commercial_id");
        return HttpResponse.json(listEnvelope([row(1)]));
      }),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    const commercialSelect = await screen.findByLabelText(/^commercial$/i);
    await within(commercialSelect).findByRole("option", { name: "Sara Alaoui" });
    fireEvent.change(commercialSelect, { target: { value: "10" } });

    await waitFor(() => expect(requestedCommercialId).toBe("10"));
  });
});

describe("permission gating", () => {
  it("shows the Record Transfer button when the operator holds create-agent-transfer", async () => {
    server.use(listHandler(listEnvelope([])), managersHandler(), commercialsHandler());
    renderPage();

    expect(
      await screen.findByRole("button", { name: "Record Transfer" }),
    ).toBeInTheDocument();
  });

  it("hides the Record Transfer button without create-agent-transfer", async () => {
    signInWith([PERMISSIONS.VIEW_AGENT_TRANSFERS]);
    server.use(listHandler(listEnvelope([])), managersHandler(), commercialsHandler());
    renderPage();

    await screen.findByText("No transfer yet.");
    expect(
      screen.queryByRole("button", { name: "Record Transfer" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to the create route on click", async () => {
    server.use(listHandler(listEnvelope([])), managersHandler(), commercialsHandler());
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Record Transfer" }));

    expect(router.state.location.pathname).toBe(NEW_PATH);
  });
});

describe("navigation", () => {
  it("View navigates to the transfer's own detail page", async () => {
    server.use(
      listHandler(listEnvelope([row(1)])),
      managersHandler(),
      commercialsHandler(),
    );
    const router = renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    expect(router.state.location.pathname).toBe("/stock/agent-transfers/1");
  });
});

describe("pagination", () => {
  it("shows no footer when there is only one page", async () => {
    server.use(
      listHandler(listEnvelope([row(1)], { last_page: 1 })),
      managersHandler(),
      commercialsHandler(),
    );
    renderPage();

    await screen.findByText("TRF-001");
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("advances to the next page and requests page=2", async () => {
    let requestedPage: string | null = null;
    server.use(
      http.get(`${API}/admin/agent-transfers`, ({ request }) => {
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
      commercialsHandler(),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    await waitFor(() => expect(requestedPage).toBe("2"));
  });
});
